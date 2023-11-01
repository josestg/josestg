+++
date = '2023-10-30T23:21:37+07:00'
draft = false
title = 'Practical Design Pattern in Go: Functional Options'
author = "Jose Sitanggang"
tags = ['golang', 'design-pattern', 'functional-options']
description = "Discover flexible object configuration in Go with a functional style"
[cover]
hiden = false
image = "https://refactoring.guru/images/patterns/content/builder/builder-en-2x.png"
alt = "Functional Options"
caption = "Image by [Refactoring.Guru](https://refactoring.guru)"
+++

The Functional Options Pattern is a design pattern for creating objects with flexible configurations by using functions as arguments to modify the default behavior.

In my opinion, this pattern can be considered a Builder Pattern with a functional style: instead of chaining methods, we compose functions to configure the object.

This pattern is widely used in Go, which might be the reason it is not explained in most design pattern books. Nevertheless, to provide some context about this pattern, let's examine the code below that I took from my [httpkit](https://github.com/josestg/httpkit) package:

```go
package httpkit

// GracefulRunner is a wrapper of http.Server that can be shutdown gracefully.
type GracefulRunner struct {
	Runner
	signalListener chan os.Signal
	waitTimeout    time.Duration
	shutdownDone   chan struct{}
	eventListener  func(event RunEvent, data string)
}

// NewGracefulRunner wraps a Server with graceful shutdown capability.
func NewGracefulRunner(server Runner) *GracefulRunner {
	gs := GracefulRunner{
		Runner:         server,
		shutdownDone:   make(chan struct{}),
		waitTimeout:    5 * time.Second,
		signalListener: make(chan os.Signal, 1),
		eventListener: func(event RunEvent, data string) {
			slog.Default().Debug("graceful runner", "event", event.String(), "data", data)
		},
	}

	signal.Notify(gs.signalListener, syscall.SIGINT)
	return &gs
}
```

In the example above, we have a struct called `GracefulRunner` that essentially wraps an `http.Server` with graceful shutdown capability, and a constructor, `NewGracefulRunner`, for creating a new instance of `GracefulRunner`. If you interested about how graceful shutdown works, you can read my article titled "**[Graceful Shutdown in Go](/posts/golang/graceful-shutdown-in-go/)**."

> Wrapping `http.Server` with graceful shutdown capability is also an example of a design pattern called the [Decorator](https://refactoring.guru/design-patterns/decorator). 

The `GracefulRunner` struct has several fields that control the behavior of the instance. As we can see in the constructor, the `GracefulRunner` has default values for each field. For example, the `waitTimeout` is set to 5 seconds, the shutdown will trigger when the SIGINT signal is received, and the event listener will log the event to the default logger.

The `GracefulRunner` will work just fine with the default values. However, we may want to change the default behavior. For example, we might want to change the wait timeout to 10 seconds or log the event in INFO level instead of DEBUG level.

But with the current implementation, we can't do that since the fields are not exported. So the easy solution is to export the fields. However, this is not a good solution because it will break encapsulation.

Alternatively, we could consider passing the configuration as nillable arguments to the constructor, so if the argument is nil, it will use the default value. Can you imagine if you only want to change the last argument? You would need to pass all the arguments before it with a nil value. This makes it hard to read.

**This is where the Functional Options pattern comes in.**

In the Functional Options pattern, there are typically four main components:

1. **Target**: the object that we want to configure.
2. **Option Type**: a type used to represent the option.
3. **Option Setter**: a function that sets the option on the target.
4. **Option Constructor**: a function that creates the option setter.

In this case, the target is the `GracefulRunner`.

Since Go is a statically typed language, we need to ensure that all the options have the same type. That's why we need the option type. This type can be a function or an interface. 
In this example, we will use a function as the option type. This option type typically accepts a reference to the target. Let's see this in action.

```go
// RunOption is a function that sets the option to the GracefulRunner.
type RunOption func(*GracefulRunner)

// NewGracefulRunner wraps a Server with graceful shutdown capability.
func NewGracefulRunner(server Runner, opts ...RunOption) *GracefulRunner {
    var gs GracefulRunner
    // apply the options to gs instance.
    // ... truncated ...
    return &gs
}
```

By using the option type, we can pass the option as an argument to the constructor as variadic arguments of the same type. This makes it easy to pass multiple options or even no options at all.

Now, let's move on to the option setter. The option setter is a function that sets the option on the target. In this case, the target is the `GracefulRunner`. Let's see this in action:

```go
// WithRunOptionSignals sets the signals that will be listened to initiate shutdown.
func WithRunOptionSignals(s *GracefulRunner) {
    s.signalListener = make(chan os.Signal, 1)
    signal.Notify(s.signalListener, syscall.SIGTERM)
}

// WithRunOptionWaitTimeout sets the timeout for waiting active connections to be closed.
func WithRunOptionWaitTimeout(s *GracefulRunner) {
    s.waitTimeout = 10 * time.Second
}

// WithRunOptionEventListener sets the listener that will be called when an event occurred.
func WithRunOptionEventListener(s *GracefulRunner) {
    s.eventListener = func(event RunEvent, data string) {
        slog.Default().Info("graceful runner", "event", event.String(), "data", data)
    }
}
```

To verify whether the option setter works, let's pass these options to the constructor:

```go
func main() {
	httpkit.NewGracefulRunner(
		&http.Server{},
		httpkit.WithRunOptionSignals,
		httpkit.WithRunOptionWaitTimeout,
		httpkit.WithRunOptionEventListener,
	)
}
```
If we compile the code, it will work just fine. We have successfully changed the default behavior of the `GracefulRunner` without breaking encapsulation. These option setters are defined in the same package as the `GracefulRunner`, so they can access the unexported fields.

Now, what if we want to change the timeout to 7 seconds and listen to both SIGINT and SIGTERM? If this is a third-party library, we would have to fork the library and change the code, which is not an ideal solution.

This is where the option constructor comes in. The option constructor is a function that creates the option setter. We parameterize the option setter by passing the value to the option constructor. Let's see this in action:
```go
package httpkit

// WithRunOptionSignals sets the signals that will be listened to initiate shutdown.
func WithRunOptionSignals(signals ...os.Signal) RunOption {
    return func(s *GracefulRunner) {
        s.signalListener = make(chan os.Signal, 1)
        signal.Notify(s.signalListener, signals...)
    }
}

// WithRunOptionWaitTimeout sets the timeout for waiting active connections to be closed.
func WithRunOptionWaitTimeout(timeout time.Duration) RunOption {
    return func(s *GracefulRunner) {
        s.waitTimeout = timeout
    }
}

// WithRunOptionEventListener sets the listener that will be called when an event occurred.
func WithRunOptionEventListener(listener func(event RunEvent, data string)) RunOption {
    return func(s *GracefulRunner) {
        s.eventListener = listener
    }
}
```

```go
package main

func main() {
    httpkit.NewGracefulRunner(
        &http.Server{},
        httpkit.WithRunOptionSignals(syscall.SIGINT, syscall.SIGTERM),
        httpkit.WithRunOptionWaitTimeout(7*time.Second),
        httpkit.WithRunOptionEventListener(func(event httpkit.RunEvent, data string) {
            fmt.Println("event:", event, "data:", data)
        }),
    )
}
```

Do you see the difference?

Now, we have used the option constructor to create the option setter. This allows us to parameterize the option setter, and the option setter, which has access to the private fields, does the actual work of setting the option on the target.

But, when are the option setters called? If they are not called, the options will not be applied to the target.

Let's back to the `NewGracefulRunner` constructor.

To apply the options to the target, we can do this by iterating over the options and calling the option setter. Let's see this in action:

```go
// NewGracefulRunner wraps a Server with graceful shutdown capability.
func NewGracefulRunner(server Runner, opts ...RunOption) *GracefulRunner {
	// set the default values
    gs := GracefulRunner{
        Runner:         server,
        shutdownDone:   make(chan struct{}),
        waitTimeout:    5 * time.Second,
        signalListener: make(chan os.Signal, 1),
        eventListener: func(event RunEvent, data string) {
            slog.Default().Debug("graceful runner", "event", event.String(), "data", data)
        },
    }
	
    // apply the custom options to gs instance.
    for _, opt := range opts {
		// opt is a function that sets the option to the GracefulRunner.
        opt(&gs)
    }
	
    return &gs
}
```

Now we have a fully working `GracefulRunner` that can be configured using the Functional Options pattern. It is crucial to set default values for required fields so that the user can pass only the options they want to change. For example, if we only want to adjust the wait timeout, we can do this:

```go
func main() {
    httpkit.NewGracefulRunner(
        &http.Server{},
        httpkit.WithRunOptionWaitTimeout(20*time.Second),
    )
}
```

...and the rest of the fields will use the default values.

Here, we have completed the Functional Options pattern, and you can find the full code [here](https://github.com/josestg/httpkit/blob/main/httprun.go).

If you are interested in seeing more examples of this pattern in action, you can check the following list to see how it is used in popular Go projects:

1. [uber-go/zap](https://github.com/uber-go/zap/blob/v1.26.0/logger.go#L68C40-L79)
2. [open-telemetry](https://github.com/open-telemetry/opentelemetry-go/blob/main/exporters/otlp/otlptrace/otlptracehttp/options.go)
3. [go-kit/kit](https://github.com/go-kit/kit/blob/dfe43fa6a8d72c23e2205d0b80e762346e203f78/transport/awslambda/handler.go#L25-L42)
4. [jackc/pgx](https://github.com/jackc/pgx/blob/cf6ef75f916648857cf7b46322d6d7af7d372917/stdlib/sql.go#L138-L162), etc.

> **DISCLAIMER**: 
> For those already familiar with the Functional Programming Paradigm, you might argue that in functional programming, mutable state is not allowed, and here we are mutating the state of the target. I agree with you guys.
> 
> But let's keep the name that way because it's already popular in the Go community.

## What's Next?

Maybe you've already noticed that creating the option setter and option constructor is a repetitive task. However, we can simplify this by using code generation tools like [options-gen](https://github.com/kazhuravlev/options-gen). Creating a code generator in Go is quite easy, thanks to the `go/ast`, `go/parser`, and `text/template` packages. Perhaps I will write an article about it in the future.
