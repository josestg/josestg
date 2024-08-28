+++
title = 'Go Concurrency Patterns: Generator'
date = '2024-08-25T21:00:11+07:00'
draft = false
author = "Jose Sitanggang"
tags = ['golang', 'concurrency-patterns', 'goroutine', 'channel', 'lazy-evaluation']
math = true
description = "A pattern that produces values on demand, allowing infinite sequences or large datasets to be generated one element at a time, optimizing memory and enabling lazy evaluation."
+++

![Generator](/images/generator.png)

The generator pattern is a mechanism for producing values on demand, meaning values are generated incrementally and only when the consumer requests them. This pattern allows for infinite sequences or large datasets to be produced one element at a time, optimizing memory usage and enabling [lazy evaluation](https://en.wikipedia.org/wiki/Lazy_evaluation). The generator pattern we'll cover in this article is similar to the [yield keyword](https://docs.python.org/3/glossary.html#term-generator) in Python and the [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators) in JavaScript.

In Go, the generator pattern is implemented using goroutines and channels. A goroutine generates values and sends them to a channel, while the consumer reads from the channel, effectively requesting the next value in the sequence. In this context, the goroutine that produces and sends values on demand functions as the generator, and the entity that reads from the channel acts as the consumer.

Let's start with a simple example and then explore how the generator pattern can effectively solve specific problems.

## Fibonacci Generator

### A Brief Introduction to Fibonacci Numbers

The Fibonacci sequence is a simple series of numbers where each number is the sum of the two preceding numbers. The sequence starts with 0 and 1, and each subsequent number is calculated by adding the two numbers before it.

The sequence begins like this:

- **Fibonacci(0) = 0**
- **Fibonacci(1) = 1**
- **Fibonacci(2) = 1** (Fibonacci(0) + Fibonacci(1))
- **Fibonacci(3) = 2** (Fibonacci(1) + Fibonacci(2))
- **Fibonacci(4) = 3** (Fibonacci(2) + Fibonacci(3))
- **Fibonacci(5) = 5** (Fibonacci(3) + Fibonacci(4))
- And so forth...

In mathematical terms, the Fibonacci sequence can be defined with the recurrence relation: $F(n) = F(n−1) + F(n−2)$ with initial conditions: $F(0) = 0$ and $F(1) = 1$.

The Fibonacci sequence appears in various natural phenomena, such as the branching of trees, the arrangement of leaves, and even in the spirals of shells. It's also widely used in computer algorithms and programming challenges.

Let’s see how we can implement this generator in Go, starting with a basic non-concurrent approach:

### Fibonacci Generator

```go
func NewFibonacciStreamV0() func() int {  
    a, b := 0, 1  
    return func() int {  
       defer func() { a, b = b, a+b }()  
       return a  
    }  
}
```

**What this v0 code does:**

1. `NewFibonacciStreamV0` creates a function (the generator) that can be used to request the next Fibonacci number.
2. `a` and `b` are closure variables that act like private fields in OOP, shared with the returned function. These variables serve as a cache for the sequence.
3. Inside the generator function, we first return `a`, and then use `defer` to calculate the next number in the sequence for future calls.

This implementation works correctly. However, for learning purposes, let's imagine that the expression `a, b = b, a+b` (which calculates the next number in the sequence) is very expensive—for example, if it involved querying a database or making API calls. In this implementation, we perform some computation to determine the next value, even though the consumer might not need it immediately.

To address this, we should make the computation lazy, meaning it is only performed when the consumer requests the next value.

```go
func NewFibonacciStreamV1() <-chan int {  
    stream := make(chan int)  
    go func() {  
       a, b := 0, 1  
       for {  
          stream <- a  
          a, b = b, a+b  
       }  
    }()  
    return stream  
}
```

**What this v1 code does:**

1. It creates an unbuffered channel called `stream` to serve as the generator, instead of returning a function as in `v0`.
2. It starts a new goroutine that generates the Fibonacci sequence. We need a goroutine because sending and receiving from an unbuffered channel are blocking operations.
3. The logic for computing the sequence and caching the results is similar to `v0`, but here, the infinite loop (`for`) sends each Fibonacci number to the `stream` channel instead of returning it directly as in `v0`.
4. The key here is `stream <- a` (sending to an unbuffered channel), which blocks until the consumer reads the value from the channel. This ensures that the theoretically slow operation (`a, b = b, a+b`) is lazily evaluated, only when requested.

While `v1` already makes the generator lazy, there are a few best practices to consider. One limitation is that there is no way to stop the generator once it has started. The generator will run indefinitely, which could lead to resource leaks if the consumer stops receiving values or if the generator is no longer needed.

To improve upon `v1`, let's introduce a mechanism for cancellation.

Remember, the responsibility for closing a channel lies with the sender—the code that writes to it. In our case, the generator is responsible for closing the stream. However, when should we close the stream, given that the loop is unbounded? Let's explore this in `v2`.

```go
func NewFibonacciStreamV2() (<-chan int, func()) {  
    stream := make(chan int)  
    quit := make(chan struct{})  
    go func() {  
       defer close(stream)  
       a, b := 0, 1  
       for {  
          select {  
          case <-quit:  
             return  
          case stream <- a:  
             a, b = b, a+b  
          }  
       }  
    }()  
  
    cancel := func() { close(quit) }  
    return stream, cancel  
}
```

**What this v2 code does:**

1. It returns a function that will close another unbuffered channel called `quit`.
2. The `quit` channel is used as a signal for termination. In the select statement in the generator goroutine, we can observe that we read from the `quit` channel or write to the stream. When the returned `cancel` function is called, the `<-quit` will be selected and it will execute the return statement, triggering the deferred closing of the stream and exiting the generator goroutine.
3. When no event is happening for the `quit` channel, if the next Fibonacci sequence is requested, the stream will receive the next Fibonacci number.

Now we can stop the generator by calling the returned cancel function. However, this pattern is common in Go, and we can utilize the context package for this cancellation mechanism.

```go
func NewFibonacciStreamV3(ctx context.Context) <-chan int {  
    stream := make(chan int)  
    go func() {  
       defer close(stream)  
       a, b := 0, 1  
       for {  
          select {  
          case <-ctx.Done():  
             return  
          case stream <- a:  
             a, b = b, a+b  
          }  
       }  
    }()  
    return stream  
}
```

**What this v3 code does:**

1. This code is similar to `v2`, but instead of handling the cancellation ourselves, we delegate the responsibility to the [context package](https://go.dev/blog/context).
2. When cancellation is triggered, the `<-ctx.Done()` channel will be selected.

In `v3`, we not only make the generator stop gracefully but also align it with idiomatic Go practices. By using the context package, we can also use timeout and deadline-based cancellation with `context.WithTimeout` and `context.WithDeadline`.

Here in `v3`, we have implemented a best-practice generator pattern that lazily computes values on demand. We utilized an unbuffered channel as the stream to make it lazy. However, we can also use a buffered channel. Let’s see the implementation in `v4` below:

```go
func NewFibonacciStreamV4(ctx context.Context, bufsize int) <-chan int {  
    stream := make(chan int, bufsize)  
    go func() {  
       defer close(stream)  
       a, b := 0, 1  
       for {  
          select {  
          case <-ctx.Done():  
             return  
          case stream <- a:  
             a, b = b, a+b  
          }  
       }  
    }()  
    return stream  
}
```

**What this v4 code does:**

1. It allows customizing the buffer size by providing the `bufsize` parameter.

When using a buffered channel instead of an unbuffered one, the generator can precompute `n-next` values, making the next request faster and only blocking when the buffer is full. The drawback is that

this implementation is not fully lazy, like `v2` and `v3`, but eventually lazy if the buffer is full. This combines aspects of `v1` and `v3`.

Here are the trade-offs for `v4`:

- **Pros**: Using a buffered channel can improve performance, especially if the producer (generator) is faster than the consumer. The generator can "get ahead" by filling up the buffer, ensuring that the consumer always has some values ready to consume immediately.
- **Cons**: The trade-off is that the generator is no longer "lazy" in producing values.

If the context is canceled and the buffer is not empty, any precomputed Fibonacci numbers in the buffer are effectively wasted. Additionally, if the buffer size is set too large, it could lead to increased memory usage.

## Real-World Applications of the Generator Pattern

Our Fibonacci Generator demonstrates how the generator pattern works, how to handle cancellation, and the differences between buffered and unbuffered channels as the stream. With this knowledge, we can apply this pattern to use cases such as:

1. Reading large files, like CSVs, one line at a time by requesting each line when needed.
2. Streaming real-time data where computations or API calls are costly, and values need to be produced only as requested.
3. Generating an infinite sequence of values, such as timestamps or random numbers, on demand without consuming excessive memory.

## Conclusion

The generator pattern in Go is a powerful tool for creating efficient, on-demand sequences of values. By combining goroutines and channels, you can implement generators that optimize memory usage and enable lazy evaluation, making them ideal for working with infinite sequences or large datasets. Whether using unbuffered or buffered channels, or integrating context for graceful cancellation, this pattern is versatile and adaptable to various real-world scenarios.

> You can the full code in this GitHub repository for more insights.
> [Go Concurrency Patterns: Generator](https://github.com/josestg/yt-go-concurrency-patterns/tree/main/generator)

## What's Next?

This article is the first in a series on concurrency patterns in Go. Throughout this series, we will explore different techniques and best practices for writing concurrent programs using Go's unique concurrency features, such as goroutines and channels.

We started with the [**Generator Pattern**](/posts/concurrency-patterns/go-concurrency-patterns-generator/), demonstrating its use in producing values on demand. In the next article, we will delve into the [**Pipeline Pattern**](/posts/concurrency-patterns/go-concurrency-patterns-pipeline).

Stay tuned for more articles in this series to deepen your understanding of Go's concurrency patterns and enhance your Go programming skills!