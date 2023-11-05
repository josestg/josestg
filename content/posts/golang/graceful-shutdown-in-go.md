+++
date = '2023-11-02T00:35:06+07:00'
draft = false
title = 'Graceful Shutdown in Go'
author = ["Jose Sitanggang"]
tags = ["golang", "tips", "microservice", "12-factor"]
description = "Learn how graceful shutdown ensures your requests stay safe during service updates by following the 12-factor principles"
+++

Imagine you have a production service running on Kubernetes that is currently processing client requests while also deploying a new version to production. What will happen to those requests?

Will those requests be lost, or will your service wait until all requests have been completed before upgrading?

Let's watch the demo below to provide a better context for the problem we are trying to solve.

{{< youtube id="DYL1mb7EdRU" title="Server without vs. with graceful shutdown" >}}

In the first part, the server is not implementing graceful shutdown. When it receives the shutdown signal, it immediately begins the shutdown procedure, even if there are still requests in process. This is undesirable because it may cause request loss or, worse, data corruption if the server performs write operations.

In the second part, when the server implements graceful shutdown, it waits until all ongoing requests have been completed before starting the shutdown procedure. Despite the fact that the server had already received the shutdown signal while it was still processing requests, it deferred the shutdown procedure.

This shutdown procedure is essential for production services, as it is listed as one of the best practices for building modern applications in the [Twelve-Factor App](https://12factor.net/disposability).

In the next section, we will discuss how the graceful shutdown procedure is implemented in Go.

## Implementation


If you already used the [`http.Server`](https://pkg.go.dev/net/http#Server) to serve your API, you're on the right track. It has a method called [Shutdown](https://pkg.go.dev/net/http#Server.Shutdown) that will reject new requests and wait until all ongoing requests are finished before proceeding with the shutdown procedure.

The missing part is that we need some way to listen to a signal that used to begin the shutdown protocol. By following the Twelve-Factor App guidelines, a signal that is used to request a shutdown is the [SIGTERM](https://cs.opensource.google/go/go/+/refs/tags/go1.21.3:src/syscall/zerrors_linux_amd64.go;l=1343) signal. We can find this signal in the syscall package. To listen to a certain signal event, we can use the [Notify](https://pkg.go.dev/os/signal#Notify) function from the signals package. But before we implement the shutdown signal listener, let us see the server code that we used in the previous video as our foundation code.

```go
func slowHandler(w http.ResponseWriter, r *http.Request) {
	id := r.Header.Get("X-Request-Id")
	log := slog.Default().With("id", id, "method", r.Method, "path", r.URL.Path)

	// simulate slow process.
	delay := time.Duration(5+rand.Intn(5)) * time.Second // 5-10 seconds.

	startedAt := time.Now()
	log.Info("req received", "delay", delay)
	defer func() {
		log.Info("req completed", "latency", time.Since(startedAt))
	}()

	time.Sleep(delay)
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, id)
}

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{}))
	slog.SetDefault(log)

	mux := http.NewServeMux()
	mux.HandleFunc("/slow-process", slowHandler)

	// create http server.
	srv := &http.Server{Addr: ":8080", Handler: mux}
	log.Info("server started", "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Error("could not start server", "error", err)
		os.Exit(1)
	}
}
```


Now let us add the signal listener that is used to start the shutdown procedure.

```diff
diff --git a/server/main.go b/server/main.go
index 284a1f5..88ce40c 100644
--- a/server/main.go
+++ b/server/main.go
@@ -6,6 +6,8 @@ import (
"math/rand"
"net/http"
"os"
+	"os/signal"
+	"syscall"
"time"
)

@@ -41,4 +43,15 @@ func main() {
log.Error("could not start server", "error", err)
os.Exit(1)
}
+
+	watchedSignals := []os.Signal{syscall.SIGINT, syscall.SIGTERM}
+
+	shutdownListener := make(chan os.Signal, 1)
+	signal.Notify(shutdownListener, watchedSignals...)
+
+	log.Info("listen for shutdown request", "watched_signals", watchedSignals)
+	select {
+	case sig := <-shutdownListener:
+		log.Info("received shutdown request", "signal", sig)
+	}
}
```

In the git diff above, I also added an interrupt signal ([SIGINT](https://cs.opensource.google/go/go/+/refs/tags/go1.21.3:src/syscall/zerrors_linux_amd64.go;l=1330)), which is a signal that will be sent if we press CTRL + C in the terminal where the server is running. However, if we run the code, we will not see the "*listen for shutdown request*" log because the [ListenAndServe](https://pkg.go.dev/net/http#Server.ListenAndServe) method is blocking. Let's fix this by moving the ListenAndServe into a separate goroutine.

```diff
diff --git a/server/main.go b/server/main.go
index 88ce40c..caf9309 100644
--- a/server/main.go
+++ b/server/main.go
@@ -38,11 +38,14 @@ func main() {
 
 	// create http server.
 	srv := &http.Server{Addr: ":8080", Handler: mux}
-	log.Info("server started", "addr", srv.Addr)
-	if err := srv.ListenAndServe(); err != nil {
-		log.Error("could not start server", "error", err)
-		os.Exit(1)
-	}
+
+	go func() {
+		log.Info("server started", "addr", srv.Addr)
+		if err := srv.ListenAndServe(); err != nil {
+			log.Error("could not start server", "error", err)
+			os.Exit(1)
+		}
+	}()
 
 	watchedSignals := []os.Signal{syscall.SIGINT, syscall.SIGTERM}
```


Because we use the select statement, the main goroutine will block until the signal listener receives a signal from the Notify method. In the current code, we have two exit points, one in the ListenAndServe goroutine and the other when the select statement is in the main goroutine. Let's move the exit point in the ListenAndServe goroutine into the main goroutine by adding a new channel that is listening to the error from the ListenAndServe method and waiting for the error in the select statement.

```diff
diff --git a/server/main.go b/server/main.go
index caf9309..4263af0 100644
--- a/server/main.go
+++ b/server/main.go
@@ -1,6 +1,7 @@
 package main
 
 import (
+	"errors"
 	"io"
 	"log/slog"
 	"math/rand"
@@ -39,11 +40,14 @@ func main() {
 	// create http server.
 	srv := &http.Server{Addr: ":8080", Handler: mux}
 
+	serverError := make(chan error, 1)
 	go func() {
 		log.Info("server started", "addr", srv.Addr)
 		if err := srv.ListenAndServe(); err != nil {
-			log.Error("could not start server", "error", err)
-			os.Exit(1)
+			// only capture error if it's not server closed error.
+			if !errors.Is(err, http.ErrServerClosed) {
+				serverError <- err
+			}
 		}
 	}()
 
@@ -54,6 +58,9 @@ func main() {
 
 	log.Info("listen for shutdown request", "watched_signals", watchedSignals)
 	select {
+	case err := <-serverError:
+		log.Error("listen and serve failed", "error", err)
+
 	case sig := <-shutdownListener:
 		log.Info("received shutdown request", "signal", sig)
 	}
```

As I mentioned previously, we add a channel to listen to the error from ListenAndServe, but there is an exception for the [ErrServerClosed](https://pkg.go.dev/net/http#ErrServerClosed) error since it tells us that the server successfully closed.

At this point, we have completed the shutdown signal listener part. The next part is to use that event to start the shutdown procedure by calling the Shutdown method from the `http.Server`.

If we take a closer look at the Shutdown method, it takes an argument [context](https://pkg.go.dev/context#Context). We don't know how long it will take to complete all the requests; it may take minutes, an hour, or maybe a day. We don't want to wait too long, which is why we need to set some deadlines that will allow the long request to be completed. We can implement this by using the context [WithTimeout](https://pkg.go.dev/context#WithTimeout).

```diff
diff --git a/server/main.go b/server/main.go
index f5f23dd..d31244f 100644
--- a/server/main.go
+++ b/server/main.go
@@ -3,6 +3,7 @@ package main
 import (
 	"context"
 	"errors"
+	"flag"
 	"io"
 	"log/slog"
 	"math/rand"
@@ -32,6 +33,10 @@ func slowHandler(w http.ResponseWriter, r *http.Request) {
 }
 
 func main() {
+	var waitTolerance time.Duration
+	flag.DurationVar(&waitTolerance, "wait", 5*time.Second, "wait tolerance for graceful shutdown")
+	flag.Parse()
+
 	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{}))
 	slog.SetDefault(log)
 
@@ -66,10 +71,14 @@ func main() {
 		log.Info("received shutdown request", "signal", sig)
 
 		// shutdown process.
-		log.Info("shutting down server")
+		log.Info("shutting down server", "wait_tolerance", waitTolerance)
 		defer log.Info("server shutdown gracefully")
 
-		if err := srv.Shutdown(context.TODO()); err != nil {
+		// we don't want to wait forever for connections to close.
+		ctx, cancel := context.WithTimeout(context.Background(), waitTolerance)
+		defer cancel()
+
+		if err := srv.Shutdown(ctx); err != nil {
 			log.Error("server shutdown failed", "error", err)
 		}
 	}
```

To make the wait tolerance dynamic, we used [flag](https://pkg.go.dev/flag#FlagSet) arguments with a default value of 5 seconds. We can run this code again by using the following command to set the wait tolerance to 10 seconds.



When the shutdown procedure is not completed within the wait tolerance, the shutdown method will return the DeadlineExceeded error. In this case, the server is not closed yet, which is why we need to force it to shut down because we don't want to wait forever. To do so, we can use the [Close](https://pkg.go.dev/net/http#Server.Close) method from the `http.Server`.

```diff
diff --git a/server/main.go b/server/main.go
index d31244f..5758e99 100644
--- a/server/main.go
+++ b/server/main.go
@@ -80,6 +80,14 @@ func main() {
 
 		if err := srv.Shutdown(ctx); err != nil {
 			log.Error("server shutdown failed", "error", err)
+			if errors.Is(err, context.DeadlineExceeded) {
+				log.Info("executing forced shutdown")
+				if err := srv.Close(); err != nil {
+					log.Error("server close failed", "error", err)
+				} else {
+					log.Info("forced shutdown completed")
+				}
+			}
 		}
 	}
 }
```


At this point, we have implemented the graceful shutdown procedure. We also provide a procedure to forcefully shutdown the server if it is not able to complete the request within a given wait tolerance.


You can find the complete [code in this repository](https://github.com/josestg/graceful-shutdown-in-go).



## What's Next?

As we can see in the implementation, we primarily used only three methods from the [`http.Server`](https://pkg.go.dev/net/http#Server) struct: [`ListenAndServe`](https://pkg.go.dev/net/http#Server.ListenAndServe), [`Shutdown`](https://pkg.go.dev/net/http#Server.Shutdown), and [`Close`](https://pkg.go.dev/net/http#Server.Close). We employed these methods to extend the server's capabilities, enabling graceful shutdown.

Essentially, this is what the Decorator Pattern does. It adds additional functionality to an existing object without altering its structure. If we define these methods as an interface, we can decorate the server with graceful shutdown capability.

You can find my own implementation of Graceful Shutdown in Go using the Decorator Pattern [here](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go). By using the [`Runner`](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go#L28) interface, the [GracefulRunner](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go#L69C6-L69C20) decorates the [`http.Server`](https://pkg.go.dev/net/http#Server) with graceful shutdown capability.