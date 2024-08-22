+++
date = '2024-08-22T19:20:06+07:00'
draft = false
title = 'How to Build a Pluggable Library in Go'
author = ["Jose Sitanggang"]
tags = ["golang", "tips"]
description = "Discover how Go's buildmode=plugin lets you dynamically extend application functionality and optimize builds by reducing binary size and avoiding unnecessary recompilation."
+++

While exploring [Envoy Proxy](https://www.envoyproxy.io/docs/envoy/latest/start/sandboxes/golang-http), I got intrigued by how users can write custom code as plugins and load those implementations at runtime. This curiosity led me down a rabbit hole of research, where I stumbled upon the `buildmode=plugin` option in [Go's official documentation](https://pkg.go.dev/cmd/go#hdr-Build_modes). [The documentation was pretty straightforward](https://pkg.go.dev/plugin#Symbol), so I decided to try it out, and now I want to share what I’ve learned.


## What is `go buildmode=plugin`?

The `go buildmode=plugin` option allows you to compile Go code into a shared object file. This file can be loaded by another Go program at runtime. It’s useful when you want to add new features to your application without rebuilding it. Instead, you can load new features as plugins.

A plugin in Go is a package compiled into a shared object (.so) file. This file can be loaded using the [plugin package in Go](https://pkg.go.dev/plugin), which lets you open the plugin, look up symbols (like functions or variables), and use them.

## Hands-on Example

To make this a bit more concrete, let’s dive into an example where this feature really shines.

I’ve put together a simple demo backend project that exposes an API for calculating the n-th Fibonacci sequence. You can find the full code [here](https://github.com/josestg/yt-go-plugin). For demonstration purposes, I’ve intentionally used a slow Fibonacci implementation. Given that the computation is slow, I added a caching layer to store the results, so if the same n-th Fibonacci number is requested again, it doesn’t need to be recalculated—we just return the cached result.

The API is exposed via a `GET /fib/{n}` endpoint, where `n` is the Fibonacci number you want to calculate. Here’s a look at how the API is implemented:

```go
// Fibonacci calculates the nth Fibonacci number.
// This algorithm is not optimized and is used for demonstration purposes.
func Fibonacci(n int64) int64 {
	if n <= 1 {
		return n
	}
	return Fibonacci(n-1) + Fibonacci(n-2)
}

// NewHandler returns an HTTP handler that calculates the nth Fibonacci number.
func NewHandler(l *slog.Logger, c cache.Cache, exp time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		defer func() {
			l.Info("request completed", "duration", time.Since(started).String())
		}()

		param := r.PathValue("n")
		n, err := strconv.ParseInt(param, 10, 64)
		if err != nil {
			l.Error("cannot parse path value", "param", param, "error", err)
			sendJSON(l, w, map[string]any{"error": "invalid value"}, http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		result := make(chan int64)
		go func() {
			cached, err := c.Get(ctx, param)
			if err != nil {
				l.Debug("cache miss; calculating the fib(n)", "n", n, "cache_error", err)
				v := Fibonacci(n)
				l.Debug("fib(n) calculated", "n", n, "result", v)
				if err := c.Set(ctx, param, strconv.FormatInt(v, 10), exp); err != nil {
					l.Error("cannot set cache", "error", err)
				}
				result <- v
				return
			}

			l.Debug("cache hit; returning the cached value", "n", n, "value", cached)
			v, _ := strconv.ParseInt(cached, 10, 64)
			result <- v
		}()

		select {
		case v := <-result:
			sendJSON(l, w, map[string]any{"result": v}, http.StatusOK)
		case <-ctx.Done():
			l.Info("request cancelled")
		}
	}
}
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/internal/fibonacci/fibonacci.go#L13-L66

The code does the following:

1. The `NewHandler` function creates a new `http.Handler`. It takes a logger, cache, and expiration duration as dependencies. The `cache.Cache` is an interface, which we’ll define shortly.
2. The returned `http.Handler` parses the `n` value from the path parameters. If there’s an error, it sends an error response. Otherwise, it checks if the n-th Fibonacci number is already in the cache. If it’s not, the handler calculates the number and stores it in the cache for future requests.
3. A goroutine handles the Fibonacci calculation and caching in a separate process, while the select statement waits for either the calculation to complete or the client to cancel the request. This ensures that if the client cancels the request, we don’t waste resources waiting for the calculation to finish.

Now, **we want to make the cache implementation selectable at runtime, when the application starts**. A straightforward approach would be to create multiple implementations within the same codebase and use a config to select the desired implementation. However, the downside is that the unselected implementations would still be part of the compiled binary, which increases the binary size. While build tags could be a solution, we’ll save that for another article. For now, we want the implementation to be chosen at runtime, not at build time. This is where `buildmode=plugin` really shines.


### Ensuring the Application Works Without a Plugin

Since we’ve defined `cache.Cache` as an interface, we can create implementations of this interface anywhere—even in a different repository. But first, let’s take a look at the `Cache` interface:

```go
// Cache defines the interface for a cache implementation.
type Cache interface {
	// Set stores a key-value pair in the cache with a specified expiration time.
	Set(ctx context.Context, key, val string, exp time.Duration) error

	// Get retrieves a value from the cache by its key.
	// Returns ErrNotFound if the key is not found.
	// Returns ErrExpired if the key has expired.
	Get(ctx context.Context, key string) (string, error)
}
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/cache/cache.go#L34-L43

Since `NewHandler` requires a `cache.Cache` implementation as a dependency, it’s a good idea to have a default implementation to ensure the code doesn’t break. So, let’s create a no-op (no-operation) implementation that does nothing.

```go
// nopCache is a no-operation cache implementation.
type nopCache int

// NopCache a singleton cache instance, which does nothing.
const NopCache nopCache = 0

// Ensure that NopCache implements the Cache interface.
var _ Cache = NopCache

// Set is a no-op and always returns nil.
func (nopCache) Set(context.Context, string, string, time.Duration) error { return nil }

// Get always returns ErrNotFound, indicating that the key does not exist in the cache.
func (nopCache) Get(context.Context, string) (string, error) { return "", ErrNotFound }
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/cache/cache.go#L48-L61

This `NopCache` implements the `cache.Cache` interface but doesn’t actually do anything. It’s just there to make sure the handler works properly.

If we run the code without any custom `cache.Cache` implementation, the API will work fine, but the results won’t be cached—meaning each call will recalculate the Fibonacci number. Here’s what the logs look like when using `NopCache` with `n=45`:

```bash
./bin/demo -port=8080 -log-level=debug

time=2024-08-22T17:39:06.853+07:00 level=INFO msg="application started"
time=2024-08-22T17:39:06.854+07:00 level=DEBUG msg="using configuration" config="{Port:8080 LogLevel:DEBUG CacheExpiration:15s CachePluginPath: CachePluginFactoryName:Factory}"
time=2024-08-22T17:39:06.854+07:00 level=INFO msg="no cache plugin configured; using nop cache"
time=2024-08-22T17:39:06.854+07:00 level=INFO msg=listening addr=:8080

time=2024-08-22T17:39:19.465+07:00 level=DEBUG msg="cache miss; calculating the fib(n)" n=45 cache_error="cache: key not found"
time=2024-08-22T17:39:23.246+07:00 level=DEBUG msg="fib(n) calculated" n=45 result=1134903170
time=2024-08-22T17:39:23.246+07:00 level=INFO msg="request completed" duration=3.781674792s


time=2024-08-22T17:39:26.409+07:00 level=DEBUG msg="cache miss; calculating the fib(n)" n=45 cache_error="cache: key not found"
time=2024-08-22T17:39:30.222+07:00 level=DEBUG msg="fib(n) calculated" n=45 result=1134903170
time=2024-08-22T17:39:30.222+07:00 level=INFO msg="request completed" duration=3.813693s
```

As expected, both calls take around 3 seconds since there’s no caching.

### Implementing the Plugin

Since the library we want to make pluggable is `cache.Cache`, we need to implement that interface. **You can implement this interface anywhere—even in a separate repository**. For this example, I’ve created two implementations: one using [in-memory cache](https://github.com/josestg/yt-go-plugin-memcache) and another using [Redis](https://github.com/josestg/yt-go-plugin-rediscache) both in separate repository.

**In-Memory Cache Plugin**

```go
package main

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/josestg/yt-go-plugin/cache"
)

// Value represents a cache entry.
type Value struct {
	Data  string
	ExpAt time.Time
}

// Memcache is a simple in-memory cache.
type Memcache struct {
	mu    sync.RWMutex
	log   *slog.Logger
	store map[string]Value
}

// Factory is the symbol the plugin loader will try to load. It must implement the cache.Factory signature.
var Factory cache.Factory = New

// New creates a new Memcache instance.
func New(log *slog.Logger) (cache.Cache, error) {
	log.Info("[plugin/memcache] loaded")
	c := &Memcache{
		mu:    sync.RWMutex{},
		log:   log,
		store: make(map[string]Value),
	}
	return c, nil
}

func (m *Memcache) Set(ctx context.Context, key, val string, exp time.Duration) error {
	m.log.InfoContext(ctx, "[plugin/memcache] set", "key", key, "val", val, "exp", exp)
	m.mu.Lock()
	m.log.DebugContext(ctx, "[plugin/memcache] lock acquired")
	defer func() {
		m.mu.Unlock()
		m.log.DebugContext(ctx, "[plugin/memcache] lock released")
	}()

	m.store[key] = Value{
		Data:  val,
		ExpAt: time.Now().Add(exp),
	}

	return nil
}

func (m *Memcache) Get(ctx context.Context, key string) (string, error) {
	m.log.InfoContext(ctx, "[plugin/memcache] get", "key", key)
	m.mu.RLock()
	v, ok := m.store[key]
	m.mu.RUnlock()
	if !ok {
		return "", cache.ErrNotFound
	}

	if time.Now().After(v.ExpAt) {
		m.log.InfoContext(ctx, "[plugin/memcache] key expired", "key", key, "val", v)
		m.mu.Lock()
		delete(m.store, key)
		m.mu.Unlock()
		return "", cache.ErrExpired
	}

	m.log.InfoContext(ctx, "[plugin/memcache] key found", "key", key, "val", v)
	return v.Data, nil
}
```
> code: https://github.com/josestg/yt-go-plugin-memcache/blob/29b76a5bd23308d41b99dc7bc06a67efa8d417a8/memcache.go

**Redis Cache Plugin**

```go
package main

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/josestg/yt-go-plugin/cache"
	"github.com/redis/go-redis/v9"
)

// RedisCache is a cache implementation that uses Redis.
type RedisCache struct {
	log    *slog.Logger
	client *redis.Client
}

// Factory is the symbol the plugin loader will try to load. It must implement the cache.Factory signature.
var Factory cache.Factory = New

// New creates a new RedisCache instance.
func New(log *slog.Logger) (cache.Cache, error) {
	log.Info("[plugin/rediscache] loaded")
	db, err := strconv.Atoi(cmp.Or(os.Getenv("REDIS_DB"), "0"))
	if err != nil {
		return nil, fmt.Errorf("parse redis db: %w", err)
	}

	c := &RedisCache{
		log: log,
		client: redis.NewClient(&redis.Options{
			Addr:     cmp.Or(os.Getenv("REDIS_ADDR"), "localhost:6379"),
			Password: cmp.Or(os.Getenv("REDIS_PASSWORD"), ""),
			DB:       db,
		}),
	}

	return c, nil
}

func (r *RedisCache) Set(ctx context.Context, key, val string, exp time.Duration) error {
	r.log.InfoContext(ctx, "[plugin/rediscache] set", "key", key, "val", val, "exp", exp)
	return r.client.Set(ctx, key, val, exp).Err()
}

func (r *RedisCache) Get(ctx context.Context, key string) (string, error) {
	r.log.InfoContext(ctx, "[plugin/rediscache] get", "key", key)
	res, err := r.client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		r.log.InfoContext(ctx, "[plugin/rediscache] key not found", "key", key)
		return "", cache.ErrNotFound
	}
	r.log.InfoContext(ctx, "[plugin/rediscache] key found", "key", key, "val", res)
	return res, err
}
```
> code: https://github.com/josestg/yt-go-plugin-rediscache/blob/01154faa9fcf96323fa276d6c328d42ae0bce81b/rediscache.go

As you can see, both plugins implement the `cache.Cache` interface. Here are a couple of important things to note:

1. Both plugins are implemented in the `main` package. This is mandatory because when we build the code as a plugin, Go requires at least one `main` package. That said, it doesn’t mean you have to write all your code in a single file. You can organize it as a typical Go project with multiple files and packages. I’ve kept it in a single file here for simplicity.
2. Both plugins have `var Factory cache.Factory = New`. While not mandatory, this is a good practice. We create a type that we expect every plugin to follow as a signature for the implementation constructor. Both plugins ensure that their `New` function (the actual constructor) is of type `cache.Factory`. This is important when we look up the constructor later.

Building the plugin is straightforward—just add the `-buildmode=plugin` flag.

```bash
# build the in memory cache plugin
go build -buildmode=plugin -o memcache.so memcache.go

# build the redis cache plugin
go build -buildmode=plugin -o rediscache.so rediscache.go
```

Running these commands will produce `memcache.so` and `rediscache.so`, which are shared object binaries that can be loaded at runtime by the `bin/demo` binary.

### Implementing the Plugin Loader

The plugin loader is pretty simple. We can use the standard `plugin` library in Go, which provides two functions, both of which are self-explanatory:

1. [Open](https://pkg.go.dev/plugin#Open): opens the shared object binary file.
2. [Lookup](https://pkg.go.dev/plugin#Plugin.Lookup): searches for an exported symbol in the shared object. The symbol can be a function or a variable. But here’s the catch: **all symbols returned by `Lookup` have a type pointer to `any`**, even if the symbol itself isn’t declared as a pointer type. Let’s see this in action.

Here’s the code to load the plugin:

```go
// loadCachePlugin loads a cache implementation from a shared object (.so) file at the specified path.
// It calls the constructor function by name, passing the necessary dependencies, and returns the initialized cache.
// If path is empty, it returns the NopCache implementation.
func loadCachePlugin(log *slog.Logger, path, name string) (cache.Cache, error) {
	if path == "" {
		log.Info("no cache plugin configured; using nop cache")
		return cache.NopCache, nil
	}

	plug, err := plugin.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open plugin %q: %w", path, err)
	}

	sym, err := plug.Lookup(name)
	if err != nil {
		return nil, fmt.Errorf("lookup symbol New: %w", err)
	}

	factoryPtr, ok := sym.(*cache.Factory)
	if !ok {
		return nil, fmt.Errorf("unexpected type %T; want %T", sym, factoryPtr)
	}

	factory := *factoryPtr
	return factory(log)
}
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/main.go#L61-L84

Take a closer look at this line: `factoryPtr, ok := sym.(*cache.Factory)`. We’re looking for the symbol `plug.Lookup("Factory")`, and as we’ve seen, each implementation has `var Factory cache.Factory = New`, not `var Factory *cache.Factory = New`.

Here’s how `cache.Factory` is defined:

```go
// Factory defines the function signature for creating a cache implementation.
type Factory func(log *slog.Logger) (Cache, error)
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/cache/cache.go#L45-L46

So, we need to dereference `factoryPtr` before calling it with the given logger.

## Demo

If we look at the `bin/demo` package’s main function, we can pass the plugin path and factory name as command-line arguments:

```go
var cfg conf
flag.IntVar(&cfg.Port, "port", 8080, "port to listen on")
flag.TextVar(&cfg.LogLevel, "log-level", slog.LevelInfo, "log level")
flag.StringVar(&cfg.CachePluginPath, "cache-plugin-path", "", "path to the cache plugin")
flag.StringVar(&cfg.CachePluginFactoryName, "cache-plugin-factory-name", "Factory", "name of the factory function in the cache plugin")
flag.DurationVar(&cfg.CacheExpiration, "cache-expiration", 15*time.Second, "duration that a cache entry will be valid for")
flag.Parse()
```
> code: https://github.com/josestg/yt-go-plugin/blob/8661a4569c6264e54cac0ad6a912011a1a777f44/main.go#L25-L31

Or you can check out the details in the help menu:
```bash
./bin/demo -h

Usage of ./bin/demo:
  -cache-expiration duration
        duration that a cache entry will be valid for (default 15s)
  -cache-plugin-factory-name string
        name of the factory function in the cache plugin (default "Factory")
  -cache-plugin-path string
        path to the cache plugin
  -log-level value
        log level (default INFO)
  -port int
        port to listen on (default 8080)
```

### Using the In-Memory Cache Implementation

```bash
 ./bin/demo -port=8080 -log-level=debug -cache-plugin-path=./memcache.so -cache-plugin-factory-name=Factory
```

Logs after calling `http://localhost:8080/fib/45` twice:

```bash
time=2024-08-22T18:31:08.372+07:00 level=INFO msg="application started"
time=2024-08-22T18:31:08.372+07:00 level=DEBUG msg="using configuration" config="{Port:8080 LogLevel:DEBUG CacheExpiration:15s CachePluginPath:./memcache.so CachePluginFactoryName:Factory}"
time=2024-08-22T18:31:08.376+07:00 level=INFO msg="[plugin/memcache] loaded"
time=2024-08-22T18:31:08.376+07:00 level=INFO msg=listening addr=:8080

time=2024-08-22T18:31:16.850+07:00 level=INFO msg="[plugin/memcache] get" key=45
time=2024-08-22T18:31:16.850+07:00 level=DEBUG msg="cache miss; calculating the fib(n)" n=45 cache_error="cache: key not found"
time=2024-08-22T18:31:20.752+07:00 level=DEBUG msg="fib(n) calculated" n=45 result=1134903170
time=2024-08-22T18:31:20.752+07:00 level=INFO msg="[plugin/memcache] set" key=45 val=1134903170 exp=15s
time=2024-08-22T18:31:20.752+07:00 level=DEBUG msg="[plugin/memcache] lock acquired"
time=2024-08-22T18:31:20.752+07:00 level=DEBUG msg="[plugin/memcache] lock released"
time=2024-08-22T18:31:20.753+07:00 level=INFO msg="request completed" duration=3.903607875s

time=2024-08-22T18:31:24.781+07:00 level=INFO msg="[plugin/memcache] get" key=45
time=2024-08-22T18:31:24.783+07:00 level=INFO msg="[plugin/memcache] key found" key=45 val="{Data:1134903170 ExpAt:2024-08-22 18:31:35.752647 +0700 WIB m=+27.380493292}"
time=2024-08-22T18:31:24.783+07:00 level=DEBUG msg="cache hit; returning the cached value" n=45 value=1134903170
time=2024-08-22T18:31:24.783+07:00 level=INFO msg="request completed" duration=1.825042ms
```

### Using the Redis Cache Implementation

```bash
./bin/demo -port=8080 -log-level=debug -cache-plugin-path=./rediscache.so -cache-plugin-factory-name=Factory
```

Logs after calling `http://localhost:8080/fib/45` twice:

```bash
time=2024-08-22T18:33:49.920+07:00 level=INFO msg="application started"
time=2024-08-22T18:33:49.920+07:00 level=DEBUG msg="using configuration" config="{Port:8080 LogLevel:DEBUG CacheExpiration:15s CachePluginPath:./rediscache.so CachePluginFactoryName:Factory}"
time=2024-08-22T18:33:49.937+07:00 level=INFO msg="[plugin/rediscache] loaded"
time=2024-08-22T18:33:49.937+07:00 level=INFO msg=listening addr=:8080

time=2024-08-22T18:34:01.143+07:00 level=INFO msg="[plugin/rediscache] get" key=45
time=2024-08-22T18:34:01.150+07:00 level=INFO msg="[plugin/rediscache] key not found" key=45
time=2024-08-22T18:34:01.150+07:00 level=DEBUG msg="cache miss; calculating the fib(n)" n=45 cache_error="cache: key not found"
time=2024-08-22T18:34:04.931+07:00 level=DEBUG msg="fib(n) calculated" n=45 result=1134903170
time=2024-08-22T18:34:04.931+07:00 level=INFO msg="[plugin/rediscache] set" key=45 val=1134903170 exp=15s
time=2024-08-22T18:34:04.934+07:00 level=INFO msg="request completed" duration=3.791582708s

time=2024-08-22T18:34:07.932+07:00 level=INFO msg="[plugin/rediscache] get" key=45
time=2024-08-22T18:34:07.936+07:00 level=INFO msg="[plugin/rediscache] key found" key=45 val=1134903170
time=2024-08-22T18:34:07.936+07:00 level=DEBUG msg="cache hit; returning the cached value" n=45 value=1134903170
time=2024-08-22T18:34:07.936+07:00 level=INFO msg="request completed" duration=4.403083ms
```

## Conclusion

The `buildmode=plugin` feature in Go is a powerful tool for enhancing applications, such as adding custom caching solutions in Envoy Proxy. It allows you to build and use plugins, enabling you to load and execute custom code at runtime without altering the main application. This not only helps in reducing the binary size but also speeds up the build process. Since plugins can be composed and updated independently, you only need to rebuild the main application if there are changes, avoiding the need to rebuild unchanged plugins.

However, it's important to consider some drawbacks. Plugin loading can introduce runtime overhead, and the plugin system has certain limitations compared to statically linked code. For instance, there may be issues with cross-platform compatibility and debugging complexity. You should carefully evaluate these aspects based on your specific needs. For more information and detailed warnings about using plugins, refer to the [Go official documentation on plugins](https://pkg.go.dev/plugin#hdr-Warnings).

