+++
date = '2023-10-29T13:50:54+07:00'
draft = false
title = 'Namespace in Go'
author = ["Jose Sitanggang"]
tags = ["golang", "tips", "design-pattern"]
description = "Discover how to create namespaces in Go, even without built-in support!"
+++

Actually, Go doesn't have a namespace feature like C++ and C# does. However, we can achieve the same effect in Go. How? Let's examine the problem for a moment to ensure that we are on the same page.

I have a package called [httpkit](https://github.com/josestg/httpkit). This package contains many helpers for developing REST APIs.

```go
package httpkit

// MuxOption is an option for customizing the ServeMux.
type MuxOption func(mux *ServeMux)

// NewServeMux creates a new ServeMux with given options.
// If no option is given, the Default option is applied.
func NewServeMux(opts ...MuxOption) *ServeMux {
	var mux ServeMux
	// apply the options to mux instance.
	// ... truncated ...
	return &mux
}

// WithMuxOptionNotFoundHandler sets the handler that is called when no matching route is found.
// If it is not set, DefaultHandler.NotFound is used.
func WithMuxOptionNotFoundHandler(handler http.Handler) MuxOption {
	return func(mux *ServeMux) { /* do something */ }
}

// WithMuxOptionMethodNotAllowedHandler sets the handler that is called when a request
// cannot be routed and HandleMethodNotAllowed is true. If it is not set, DefaultHandler.MethodNotAllowed is used.
func WithMuxOptionMethodNotAllowedHandler(handler http.Handler) MuxOption {
	return func(mux *ServeMux) { /* do something */ }
}
```

...and it also has another constructor with an optional argument in the same package:


```go
package httpkit

// NewGracefulRunner wraps a Server with graceful shutdown capability.
// It will listen to SIGINT and SIGTERM signals to initiate shutdown and
// wait for all active connections to be closed. If still active connections
// after wait timeout exceeded, it will force close the server. The default
// wait timeout is 5 seconds.
func NewGracefulRunner(server Runner, opts ...RunOption) *GracefulRunner {
	var gs GracefulRunner
	// apply the options to gs instance.
	// ... truncated ...
	return &gs
}

// WithRunOptionSignals sets the signals that will be listened to initiate shutdown.
func WithRunOptionSignals(signals ...os.Signal) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}

// WithRunOptionEventListener sets the timeout for waiting active connections to be closed.
func WithRunOptionEventListener(timeout time.Duration) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}

// WithRunOptionEventListener sets the listener that will be called when an event occurred.
func WithRunOptionEventListener(listener func(event RunEvent, data string)) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}
```

Do you notice the problem?

> Btw, if you're not familiar with the Functional Option pattern, please check out my article titled "**[Functional Option Pattern in Go](/posts/golang/functional-option-pattern-in-go/)**." 

The first issue arises when we use a code editor or IDE. While typing the package name, we are presented with suggestions for all exposed functions that are available. In my opinion, this is not ideal because users are confronted with too many options. The second problem pertains to naming. We need to prefix the option names with the type of the option. For example, `WithRunOption` is the option for the `NewGracefulRunner`, and `WithMuxOption` is the option for the `NewServeMux`. Let's take a look at how these options are used:

```go
mux := httpkit.NewServeMux(
    httpkit.WithMuxOptionNotFoundHandler(CustomNotFoundHandler()),
    httpkit.WithMuxOptionMethodNotAllowedHandler(CustomMethodNotAllowedHandler()),
)

srv := http.Server{Addr: ":8080", Handler: mux}

run := httpkit.NewGracefulRunner(&srv,
    httpkit.WithRunOptionSignals(syscall.SIGINT, syscall.SIGTERM),
    httpkit.WithRunOptionWaitTimeout(5*time.Second),
    httpkit.WithRunOptionEventListener(EventListener),
)
```
Personally, I don't like the naming, but if you are okay with it, go for it.

Basically, we add a prefix to inform the users of this package that those with the same prefix are in one group; this is essentially creating a namespace. We achieve this by hardcoding the prefix. In C++, we can create a `namespace` block, and anything inside the namespace is only accessible by the prefix name. For example, in C++, to access `cout`, we need to type `std::cout`, where `std` is the namespace.

Go does not have this feature. Go is a very simple yet powerful language, but we can achieve the same thing by using existing features.

As we know, we can create a new type based on a built-in type in Go. For example, we can create a new type from `int`, `string`, `bool`, and so on.

Let's see the type that is created from `int`.

```go
type Integer int
```
With this new type, `Integer`, we can associate a method with it. Let's create a method that checks whether the `Integer` is an even number or not.

```go
type Integer int

func (n Integer) IsEven() bool { return n%2 == 0 }

func main() {
    odd := Integer(3)
    even := Integer(6)
    fmt.Println(odd, odd.IsEven())
    fmt.Println(even, even.IsEven())
}
```

The output will be:

```shell
3 false
6 true
```
But there is a unique property of `int*`, `uint*`, `float*`, `string`, and `bool` (`*` suffix means with all variants, i.e., `int8`, `int16`, ...).

The size of these types can be determined at compile time, which means these types can be declared using `const`. With this behavior, we can create a global and singleton instance without the need for mutex or atomic locking, since, if declared with `const`, it cannot be modified after creation.

Now, let's use this concept to create a namespace for the previous example.

```go
package httpkit

// muxOptionNamespace is an internal type for grouping options.
type muxOptionNamespace int

// MuxOpts is a namespace for accessing options.
const MuxOpts muxOptionNamespace = 0

// NotFoundHandler sets the handler that is called when no matching route is found.
// If it is not set, DefaultHandler.NotFound is used.
func (muxOptionNamespace) NotFoundHandler(handler http.Handler) MuxOption {
	return func(mux *ServeMux) { /* do something */ }
}

// MethodNotAllowedHandler sets the handler that is called when a request
// cannot be routed and HandleMethodNotAllowed is true. If it is not set, DefaultHandler.MethodNotAllowed is used.
func (muxOptionNamespace) MethodNotAllowedHandler(handler http.Handler) MuxOption {
	return func(mux *ServeMux) {/* do something */ }
}
```

...and for `RunOption`:

```go
package httpkit

// runOptionNamespace is type for grouping run options.
type runOptionNamespace int

// RunOpts is the namespace for accessing the Option for customizing the GracefulRunner.
const RunOpts runOptionNamespace = 0

// Signals sets the signals that will be listened to initiate shutdown.
func (runOptionNamespace) Signals(signals ...os.Signal) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}

// WaitTimeout sets the timeout for waiting active connections to be closed.
func (runOptionNamespace) WaitTimeout(timeout time.Duration) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}

// EventListener sets the listener that will be called when an event occurred.
func (runOptionNamespace) EventListener(listener func(event RunEvent, data string)) RunOption {
	return func(s *GracefulRunner) { /* do something */ }
}
```
We create two new **private** types that are created from the `int` type: `muxOptionNamespace` and `runOptionNamespace`. Then we create **public** instances of both types, and the specific values don't matter. The `MuxOpts` and `RunOpts` instances are used as constants, making these instances immutable, effectively turning them into singletons.

Next, we define a method for both `muxOptionNamespace` and `runOptionNamespace` by moving the option as a method. Now, these methods are only accessible through the `muxOptionNamespace` or `runOptionNamespace` instances. Since these types are **private**, only this package can create new instances for each type.

Both `MuxOpts` and `RunOpts` become namespaces for their respective methods. Let's see this in action:

```go
mux := httpkit.NewServeMux(
    httpkit.MuxOpts.NotFoundHandler(CustomNotFoundHandler()),
    httpkit.MuxOpts.MethodNotAllowedHandler(CustomMethodNotAllowedHandler()),
)

srv := http.Server{Addr: ":8080", Handler: mux}

run := httpkit.NewGracefulRunner(&srv,
    httpkit.RunOpts.Signals(syscall.SIGINT, syscall.SIGTERM),
    httpkit.RunOpts.WaitTimeout(5*time.Second),
    httpkit.RunOpts.EventListener(EventListener),
)
```

Notice the difference; now we use `MuxOpts` and `RunOpts` as namespaces for accessing the options for `NewServeMux` and `NewGracefulRunner`. Furthermore, these options are no longer available at the package level, which reduces the number of exposed APIs to package users.

That's all for now. I hope you've enjoyed this blog post. If you have any questions or suggestions, please feel free to leave a comment below. Thank you for reading!