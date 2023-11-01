+++
date = '2023-11-02T00:35:06+07:00'
draft = false
title = 'Graceful Shutdown in Go'
author = ["Jose Sitanggang"]
tags = ["golang", "tips", "microservice", "12-factor"]
description = "Learn how graceful shutdown ensures your requests stay safe during service updates by following the 12-factor principles"
+++

Imagine you have a production service running on Kubernetes or any other container orchestration platform. Your service is currently processing client requests, and at the same time, you're deploying a new version of your service to production. What will happen to your client requests?

Will they be interrupted, potentially leading to request loss?
Or will your service wait until all the requests are finished before switching to the new version?

Let's watch the demo below to provide a better context for the problem we are trying to solve.

{{< youtube id="DYL1mb7EdRU" title="Server without vs. with graceful shutdown" >}}


As we can see in the video, when the server does not implement the graceful shutdown, it immediately proceeds with the shutdown process, even though there are still ongoing requests. This is bad because it can lead to request loss or, even worse can lead data corruption if the server performs write operations.

In the second part, when the server implements the graceful shutdown, it waits until all ongoing requests are finished before proceeding with the shutdown process. We can see in the video that all client requests are finished before the server shutdown, even though the server had already received the shutdown request while it was still processing requests.


The shutdown mechanism is crucial for production services, as it is mentioned in the [Twelve-Factor App](https://12factor.net/disposability) as one of the best practices for building modern applications.


How do we implement this in Go? Let's find out!

## Implementation

If you have already used the [`http.Server`](https://pkg.go.dev/net/http#Server) to serve your [`http.Handler`](https://pkg.go.dev/net/http#Handler) (or a router like [`http.ServeMux`](https://pkg.go.dev/net/http#ServeMux)), you're on the right track. The [`http.Server`](https://pkg.go.dev/net/http#Server) has a method called [`Shutdown`](https://pkg.go.dev/net/http#Server.Shutdown) that essentially does what we need. **It will reject new requests and wait until all ongoing requests are finished before proceeding with the shutdown process**.

The missing part is that we need a way to listen for a shutdown signal to trigger the shutdown process. Following the [Twelve-Factor App](https://12factor.net/disposability) guidelines, the shutdown request will be performed when the server receives the `SIGTERM` signal. Fortunately, the Go standard library provides everything we need. We can use [`signal.Notify`](https://pkg.go.dev/os/signal#Notify) to listen for certain signals, with [`syscall.SIGTERM`](https://cs.opensource.google/go/go/+/refs/tags/go1.21.3:src/syscall/zerrors_linux_amd64.go;l=1343) as the signal we want to watch.

Before we continue, let's take a look at the code that will serve as the basis for our implementation:

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

This is the server code that we have already seen in the demo video. You can find the gist [here](https://github.com/josestg/graceful-shutdown-in-go/blob/cdf7e3b430ce2dd0c1b8de0ccb6029f93bc7e1c1/server/main.go#L12-L44).

Now let's add the shutdown signal listener:


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

In the diff above, you can see that we used [`signal.Notify`](https://pkg.go.dev/os/signal#Notify) to listen for the `SIGINT` and `SIGTERM` signals. We also create a channel with a size of 1 to receive the signal, as required by the [`signal.Notify`](https://pkg.go.dev/os/signal#Notify) documentation.

Next, we utilize the [`select`](https://tour.golang.org/concurrency/5) statement to wait for the signal. The [`select`](https://tour.golang.org/concurrency/5) statement will block until one of the cases is ready. In this scenario, the [`select`](https://tour.golang.org/concurrency/5) statement will block until `SIGINT` or `SIGTERM` is received.

However, when you run the code, you won't see this log in the console:

```go
log.Info("listen for shutdown request", "watched_signals", watchedSignals)
```

This is because `srv.ListenAndServe()` is blocking. To address this, we need to run it in a separate goroutine.

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

Now, when you run the code, you will see the following logs:

```log
time=2023-11-01T19:33:22.830+07:00 level=INFO msg="server started" addr=:8080
time=2023-11-01T19:33:22.830+07:00 level=INFO msg="listen for shutdown request" watched_signals="[interrupt terminated]"
```

Using `os.Exit(1)` is not considered best practice. We also have separate exit points, one when the server encounters an error, and another when the shutdown signal is received. To address this, let's add a new channel to capture errors from `srv.ListenAndServe()` and then listen for the error within the `select` statement.

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

Additionally, since the `http.ErrServerClosed` error is not considered an error, we don't listen to it.

We have completed the missing part, which is listening for the shutdown signal. 

The next step is to call [`srv.Shutdown`](https://pkg.go.dev/net/http#Server.Shutdown) when the shutdown signal is received. Let's add it to the `select` statement.

Demo 2:

```diff
diff --git a/server/main.go b/server/main.go
index 4263af0..f5f23dd 100644
--- a/server/main.go
+++ b/server/main.go
@@ -1,6 +1,7 @@
 package main
 
 import (
+	"context"
 	"errors"
 	"io"
 	"log/slog"
@@ -63,5 +64,13 @@ func main() {
 
 	case sig := <-shutdownListener:
 		log.Info("received shutdown request", "signal", sig)
+
+		// shutdown process.
+		log.Info("shutting down server")
+		defer log.Info("server shutdown gracefully")
+
+		if err := srv.Shutdown(context.TODO()); err != nil {
+			log.Error("server shutdown failed", "error", err)
+		}
 	}
 }
```

At this point, when a shutdown signal is received, the server proceeds with the shutdown process.

If we take a closer look, there's a reason why the shutdown process takes a [`context.Context`](https://pkg.go.dev/context#Context) as an argument. The [`context.Context`](https://pkg.go.dev/context#Context) is used to set a deadline for the shutdown process. This is important because we don't want to wait indefinitely for the shutdown process to complete.

To make testing easier, let's use flags as arguments to set the wait tolerance for the shutdown process.

```diff

Add wait tolerance.

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

We replaced the [`context.TODO()`](https://pkg.go.dev/context#TODO) with [`context.Background()`](https://pkg.go.dev/context#Background) and set the wait tolerance using [`context.WithTimeout`](https://pkg.go.dev/context#WithTimeout).

We can use the following command to set the wait tolerance to 10 seconds.

```shell
./bin/server -wait 10s
```

When the shutdown process is not completed within the wait tolerance, `srv.Shutdown` will return a [`context.DeadlineExceeded`](https://pkg.go.dev/context#DeadlineExceeded) error. If we encounter this error, we can force the server to close by calling [`srv.Close`](https://pkg.go.dev/net/http#Server.Close). This is the last resort to ensure the server is closed.

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

At this point, we have completed the implementation of graceful shutdown. We have also provided some wait tolerance to ensure the server is closed within a certain time frame. If it's not, we force the server to close.

You can find the complete code [here](https://github.com/josestg/graceful-shutdown-in-go) and you can follow the commit history to see the changes for each step.

## Conclusion

In this article, we have learned how to implement graceful shutdown in Go, which is one of the best practices for building modern applications as mentioned in the [Twelve-Factor App](https://12factor.net/disposability) guidelines. We also learned how context is used to set a deadline for the shutdown process and channel as a way for goroutines to communicate with each other.


## What's Next?

As we can see in the implementation, we primarily used only three methods from the [`http.Server`](https://pkg.go.dev/net/http#Server) struct: [`ListenAndServe`](https://pkg.go.dev/net/http#Server.ListenAndServe), [`Shutdown`](https://pkg.go.dev/net/http#Server.Shutdown), and [`Close`](https://pkg.go.dev/net/http#Server.Close). We employed these methods to extend the server's capabilities, enabling graceful shutdown.

Essentially, this is what the Decorator Pattern does. It adds additional functionality to an existing object without altering its structure. If we define these methods as an interface, we can decorate the server with graceful shutdown capability.

You can find my own implementation of Graceful Shutdown in Go using the Decorator Pattern [here](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go). By using the [`Runner`](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go#L28) interface, the [GracefulRunner](https://github.com/josestg/httpkit/blob/9dd8014e7a7822e5d1aecb883a7d48deb2655a8d/httprun.go#L69C6-L69C20) decorates the [`http.Server`](https://pkg.go.dev/net/http#Server) with graceful shutdown capability.