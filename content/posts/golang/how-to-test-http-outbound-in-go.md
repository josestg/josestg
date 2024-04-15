+++
title = 'How to Test HTTP Outbound in Go Using Just the Standard Library'
date = '2024-04-15T19:19:47.255+07:00'
draft = false
author = "Jose Sitanggang"
tags = ['golang', 'http', 'microservices', 'testing']
description = "My approach to testing HTTP outbound in Go using just the standard library."
+++

The Go standard library is rich and powerful, but we often find ourselves needing third-party libraries to test HTTP outbound. Similar to testing an HTTP handler with the `httptest` package, we can also test HTTP outbound either with `httptest` or by extending the `http.RoundTripper` package. This article will demonstrate how to test HTTP outbound in Go.

## Prepare the Playground

To ensure we're on the same page, let's clone this repository to use as our base code.

```bash
git clone git@github.com:josestg/gotips.git
cd gotips
```

We need to check out this specific version to ensure we all have the same code.

```bash
git checkout 3420b1c
cd how-to-test-http-outbound
```

Let's focus on the `http_outbound.go` file, which contains the client code for calling the external API (`jsonplaceholder.typicode.com`)

For simplicity, we have two functions in the `http_outbound.go` file:

1. The `GetPost` function retrieves a post by ID.
2. The `GetPosts` function retrieves all posts.

Both of these functions utilize the same base function `fetch`, which performs the actual HTTP request and decodes the response. The code should be self-explanatory, so let's proceed to the next part.

## Testing Using `httptest.Server`

The first approach is to use `httptest.Server` to mock the external API. This is the simplest way to test HTTP outbound in Go. The `httptest.NewServer` function creates an actual server that listens on a local port and returns a URL that we can use to make requests to the server. Since `httptest.NewServer` takes an `http.Handler` as an argument, we can use `http.ServeMux` to mock the external API routes.

Before that, there are a few strategies to create a mock server:

1. We create a mock server for each test case.
2. We create a mock server once and reuse it for all test cases.

In this article, we will use the second strategy. We define the mock server once, and we will reuse it for all test cases. However, since all tests in Go are run concurrently, we need to ensure that the mock server is created before the test starts and closed after the test ends. Here, the `TestMain` function comes to the rescue.

Let's first create the skeleton for `TestMain` in the `http_outbound_test.go` file.

```go
package how_to_test_http_outbound

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

var (
	// We make the testServer global so that we can utilize testServer.Client() to instantiate a client.
	testServer *httptest.Server

	// The test data will be utilized to mock the responses from the external service.
	testDataPosts = []Post{
		{ID: 1, UserID: 1, Title: "title1", Body: "body1"},
		{ID: 2, UserID: 1, Title: "title2", Body: "body2"},
		{ID: 3, UserID: 2, Title: "title3", Body: "body3"},
	}
)

func TestMain(m *testing.M) {
	// `mux` serves as the mock router where we register the endpoints of the external service.
	mux := http.NewServeMux()

	// It is acceptable to use global variables in `TestMain` without synchronization, 
	// as `TestMain` is executed only once and before any test.
	testServer = httptest.NewServer(mux)

	// `m.Run()` will execute the actual tests.
	exitCode := m.Run()
	
	// Since we will be using `os.Exit` to terminate the test, we cannot utilize defer. 
	// So we need to close the test server after `m.Run()` is executed.
	testServer.Close()
	
	os.Exit(exitCode)
}
```

I hope the code and the comment are self-explanatory.

Now, let's create the first test case to test the `GetPost` function.

```go
func TestJSONPlaceholderOutbound_GetPost(t *testing.T) {
	// Create a client that is already bound to the test server.
	client := testServer.Client()
	
	// Create a `JSONPlaceholderOutbound` instance with the URL of the test server.
	jp := NewJSONPlaceholderOutbound(client, testServer.URL)

    // We iterate over the test data and invoke `GetPost` for each post.
	for _, want := range testDataPosts {
		got, err := jp.GetPost(context.Background(), want.ID)
		if err != nil {
			t.Fatalf("GetPost failed: %v", err)
		}

        // We compare the returned post with the expected post.
		if *got != want {
			t.Errorf("GetPost returned post %d: got %v, want %v", want.ID, got, want)
		}
	}
}
```

The test code for `GetPost` is completed. However, there is a missing part in the mock server setup, we have not registered the router for the `/posts/{id}` endpoint. Let's add the router in the `TestMain` function.

```go
func TestMain(m *testing.M) {
	mux := http.NewServeMux()
	
	mux.HandleFunc("GET /posts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

        // We iterate over the test data to find the post with the given ID.
		for _, p := range testDataPosts {
			if p.ID == id {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(p)
				return
			}
		}

		http.Error(w, "post not found", http.StatusNotFound)
	})

	testServer = httptest.NewServer(mux)

	exitCode := m.Run()
	testServer.Close()
	os.Exit(exitCode)
}
```

> If you're using Go version 1.22 or later, you can utilize `http.NewServMux()` from the standard library, which supports method-based handlers and path parameters. For versions below 1.22, you'll need to handle methods and path parameters manually with a `switch` statement or use third-party libraries like `gorilla/mux`, `chi`, or `httprouter`.

For the `GetPosts` function, we can employ the same approach as the `GetPost` function. I'll leave it to you as an exercise. However, if you want to see the complete code, you can find it in the [repository](https://github.com/josestg/gotips/blob/3420b1c6473e28c9ad386e77aee0fcc038461937/how-to-test-http-outbound/http_outbound_test.go).

With this approach, we are mostly only able to test the happy path and some basic errors like 400 and 404. To test failure scenarios, in most cases, I just create a new `httptest.Server` and `http.HandlerFunc` in the test function that needs to test the failure scenarios.

In my opinion, this first approach is not scalable for complex scenarios. This is why I think the second approach is more acceptable.

## Testing by Extending `http.RoundTripper`

The `http.RoundTripper` is essentially an interface representing an HTTP transport. The `http.Client` utilizes `http.RoundTripper` to execute HTTP requests. By extending the `http.RoundTripper`, we can intercept both the request and response, enabling us to mock the external API responses. Let's see this in action by creating a simple `http.Client` with the default round tripper transport.

```go
package transporttest

import (
    "net/http"
)

func NewClient() *http.Client {
	return &http.Client{
		Transport: http.DefaultTransport,
	}
}
```

The `http.Client.Transport` field is an interface of `http.RoundTripper` that only requires one method, `RoundTrip`, as shown below.

```go
// copied from net/http package

type RoundTripper interface {
    RoundTrip(*Request) (*Response, error)
}
```

The basic idea is to wrap the `http.DefaultTransport` with our custom round tripper that will intercept the request and response. This design pattern is called the decorator pattern (if you're unfamiliar with this pattern, you can read about it [here](https://refactoring.guru/design-patterns/decorator)).

Let's create the `http.RoundTripper` decorator type.

```go
// Decorator decorates the given http.RoundTripper with additional functionality.
type Decorator func(http.RoundTripper) http.RoundTripper
```

Since the `http.RoundTripper` just requires one method, this is the perfect candidate for the adapter pattern that we can use to implement `http.RoundTripper` by using an ordinary function. (If you're unfamiliar with this pattern, you can read about it [here](https://www.josestg.com/posts/design-pattern/adapter/)).


Let's create the adapter for the `http.RoundTripper`.

```go
// Interceptor is an adapter for http.RoundTripper that turns an ordinary function into a
// RoundTripper implementation.
type Interceptor func(req *http.Request) (*http.Response, error)

// RoundTrip implements the RoundTripper.
// The RoundTrip calls the Interceptor function.
func (f Interceptor) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
```

The final step of the decorator pattern is to create a `Decorate` function that will fold a set of decorators into a single decorator, as shown below.

```go
func Decorate(transport http.RoundTripper, decorators ...Decorator) http.RoundTripper {
	decorated := transport
	for i := len(decorators) - 1; i >= 0; i-- {
		decorated = decorators[i](decorated)
	}
	return decorated
}
```

We need to iterate through the decorators in reverse order to ensure that the first decorator is executed first and the last decorator is executed last, ensuring the first decorator becomes the outermost and the last decorator is the innermost.

All required types are completed. Let's modify the `NewClient` function to accept a set of `http.RoundTripper` decorators.

```go
func NewClient(decorators ...Decorator) *http.Client {
    return &http.Client{
        Transport: Decorate(http.DefaultTransport, decorators...),
    }
}
```

Before we create the assertion utility, let's see how all of these pieces are brought together in the test function, giving us a better understanding of the whole picture.

Here is the rewritten `GetPost` test function using the `http.RoundTripper`.

```go
func TestJSONPlaceholderOutbound_GetPost(t *testing.T) {
	for _, post := range testDataPosts {
		client := transporttest.NewClient(
			transporttest.AssertHost(t, "example.com"),
			transporttest.AssertMethod(t, http.MethodGet),
			transporttest.AssertPath(t, "/posts/"+strconv.FormatInt(post.ID, 10)),
			transporttest.RespondJSON(post, http.StatusOK),
		)

		jp := NewJSONPlaceholderOutbound(client, "https://example.com")
		got, err := jp.GetPost(context.Background(), post.ID)
		if err != nil {
			t.Fatalf("GetPost failed: %v", err)
		}

		if *got != post {
			t.Errorf("GetPost returned: got %v, want %v", *got, post)
		}
	}
}
```

The `transporttest.AssertHost`, `transporttest.AssertMethod`, `transporttest.AssertPath`, and `transporttest.RespondJSON` are decorators that will be used to assert the request and respond with the given response. Let's see how those decorators are implemented.

### AssertHost

This decorator will intercept the request and assert whether the request's host is equal to the given host, disregarding the schema such as `http` or `https`.

```go
func AssertHost(t *testing.T, want string) Decorator {
	return func(transport http.RoundTripper) http.RoundTripper {
		return Interceptor(func(req *http.Request) (*http.Response, error) {
			if req.URL.Host != want {
				t.Errorf("unexpected host: got %s, want %s", req.URL.Host, want)
			}
			return transport.RoundTrip(req)
		})
	}
}
```

Let's examine the `AssertHost` decorator line by line:

1. The `AssertHost` function accepts two arguments: the testing `*testing.T` and the expected host. It returns a `Decorator` function.
2. The `Decorator` function essentially takes the `http.RoundTripper` as an argument and returns another `http.RoundTripper` that wraps our custom logic.
3. Because the `http.RoundTripper` is an interface, we need to create an implementation of the `RoundTrip` method to add our custom logic. Normally, we would create a struct that implements the `RoundTripper` interface, but in this case, we have already created an adapter that can be used to convert an ordinary function into a `RoundTripper` implementation, which is the `Interceptor` type.
4. In the `Interceptor` implementation, we can access the request object and perform our custom logic. In this case, we can use `req.URL.Host` to retrieve the host from the request object and compare it with the expected host.
5. The final step is to call the original `RoundTrip` method from the `transport` that is given in the `Decorator` type to continue the request to the next decorator.

From the perspective of `AssertHost`, in the `GetPost` test function, the next decorator is the `AssertMethod` decorator.

### AssertMethod

This decorator will intercept the request and assert whether the request's method is equal to the given method.

```go
func AssertMethod(t *testing.T, want string) Decorator {
	return func(transport http.RoundTripper) http.RoundTripper {
		return Interceptor(func(req *http.Request) (*http.Response, error) {
			if req.Method != want {
				t.Errorf("unexpected method: got %s, want %s", req.Method, want)
			}
			return transport.RoundTrip(req)
		})
	}
}
```

### AssertPath

This decorator will intercept the request and assert whether the request's path is equal to the given path.

```go
func AssertPath(t *testing.T, want string) Decorator {
	return func(transport http.RoundTripper) http.RoundTripper {
		return Interceptor(func(req *http.Request) (*http.Response, error) {
			if req.URL.Path != want {
				t.Errorf("unexpected path: got %s, want %s", req.URL.Path, want)
			}
			return transport.RoundTrip(req)
		})
	}
}
```

### RespondJSON

In the previous decorator, although the code looks similar, there is a crucial difference. Here, sending a response is the final step, so we don't need to call `transport.RoundTrip(req)` afterward. This is important because we're only mocking the response and not actually sending the request to the external API. Hence, when creating the `http.Client`, we can replace `http.DefaultTransport` with `nil`, as it's never called. Let's review the `RespondJSON` decorator.

```go
func RespondJSON(data any, code int) Decorator {
	return func(_ http.RoundTripper) http.RoundTripper {
		return Interceptor(func(req *http.Request) (*http.Response, error) {
			w := httptest.NewRecorder()
			w.WriteHeader(code)
			w.Header().Set("Content-Type", "application/json")
			err := json.NewEncoder(w).Encode(data)
			return w.Result(), err
		})
	}
}
```

We used `httptest.NewRecorder()` to mock the response body, headers, and status code. `json.NewEncoder(w).Encode(data)` is employed to encode the data into the response body. Finally, `w.Result()` is used to obtain the `http.Response` from the `httptest.ResponseRecorder`.

That's all. We've just created a testing library to test HTTP outbound functionality in Go. You can review the complete code in the [repository](https://github.com/josestg/gotips/blob/main/how-to-test-http-outbound/http_outbound_test.go).

## Conclusion

The first approach is simple and easy to understand, but it is not scalable for complex scenarios. The second approach is more suitable for complex scenarios, but it requires a lot of boilerplate code to start. However, the boilerplate test becomes a library that we can reuse for other test cases or even other projects.

The first approach is also slower than the second approach because it actually creates a server, and the client sends the request to the actual server. On the other hand, the second approach does not need a server and does not send the request to the actual server, making it faster.

Lastly, the second approach is very flexible. If we want new behavior, we just need to create a new decorator. That's why the second approach is more suitable for complex scenarios.