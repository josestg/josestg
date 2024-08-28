+++
title = 'Go Concurrency Patterns: Pipeline'
date = '2024-08-26T21:00:11+07:00'
draft = false
author = "Jose Sitanggang"
tags = ['golang', 'concurrency-patterns', 'goroutine', 'channel', 'pipeline']
math = true
description = "A pattern that processes data in stages, allowing each step to be handled concurrently, optimizing performance and enabling efficient, scalable data pipelines."
+++

![Pipeline](/images/pipeline.png)

In a previous article, we explored the [Generator pattern](/posts/concurrency-patterns/go-concurrency-patterns-generator/), which allows us to compute values lazily in Go. Now, we’re diving into another concurrency pattern: the Pipeline. This pattern enables us to process data step-by-step through a series of operators. If you're familiar with [Java Streams](https://docs.oracle.com/javase/8/docs/api/java/util/stream/Stream.html), which process data by passing each value through a set of filters, we’ll be taking a similar approach but leveraging Go's concurrency features.

Consider the following Java example:

```java
Stream
	.of(1, 2, 3, 4, 5) // creating the source stream
	.filter(e -> e % 2 == 1) // T1: first operator
	.map(e -> e * 3) // T2: second operator
	.map(e -> e + 1) // T3: third operator
	.forEach(System.out::println); // Terminal operator
```

In this code, a stream is created from a list of numbers. The stream processes each number sequentially, first filtering out even numbers. For example, when `1` passes through the filter, it’s recognized as odd, so it proceeds to the next step where it’s multiplied by `3`, resulting in `3`. This value is then incremented by `1`, becoming `4`, and finally, it's printed. This process repeats for each number in the stream, one by one, until all numbers have been processed.

Or you can see this visually in the image below:

![Stream Pipeline](https://miro.medium.com/v2/resize:fit:1286/format:webp/0*Fpgefe6sILOkMNeG)
> Source: [Tarun Jain](https://tarunjain07.medium.com/notes-java8-stream-terminal-vs-non-terminal-operation-etc-945c0644468d)

To understand this pattern, we can break it down into three main components:

1. **Stream Creator**: This component takes a list of values and emits each value one at a time, as needed.
2. **Stream Pipeline (Operators)**:
   1. **Non-terminal Operators**: These operators process each value and pass the result to the next operator in the pipeline.
   2. **Terminal Operator**: This is the final operator in the pipeline, where the processing ends.

Now, let's implement this in Go.

## Stream Creator

We'll start by creating a `StreamOf` function that acts as the Stream Creator. This function takes a variadic argument of type `T`, where `T` is a generic type that can represent any type in Go. The function returns a read-only stream channel. Since the sequence has a known end, we can safely close the stream once all items have been emitted.

```go
// StreamOf creates a stream of items of type T.
func StreamOf[T any](seq ...T) <-chan T {
	stream := make(chan T)
	go func() {
		defer close(stream)
		for _, item := range seq {
			stream <- item
		}
	}()
	return stream
}
```

## Defining Operators

In Java Streams, we often use an object-oriented approach with method chaining. To achieve similar behavior in Go, we'll use function composition. Let's define the `Operator` type, which represents a pipeline operator:

```go
type Operator[T any] func(inp <-chan T) (out <-chan T)
```

Each operator takes a read-only input stream (`inp`), processes the data according to the operator's logic, and returns a new read-only output stream (`out`). The next operator in the pipeline will then use this `out` stream as its `inp` stream, allowing us to chain multiple operations together.

## Constructing the Pipeline

Now that we have the `Operator` type, let's apply these operators to the source stream using a `Pipeline` function:

```go
func Pipeline[T any](source <-chan T, operators ...Operator[T]) <-chan T {
	stream := source
	for _, operator := range operators {
		stream = operator(stream)
	}
	return stream
}
```

The `Pipeline` function constructs a new read-only stream by chaining all the provided operators. However, the returned stream doesn't emit any values immediately; no operators are executed at this point. The operators will only be executed when values are actually read from the returned stream.

## Implementing a Simple Operator

Let's implement a simple operator that filters odd numbers:

```go
func AcceptOdd(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range in {
			if v%2 == 1 {
				out <- v
			}
		}
	}()
	return out
}
```

As we can see, the `AcceptOdd` operator follows the `Operator` type signature. Now, let's try this with the `Pipeline` and `StreamOf` function.

```go
func main() {
	piped := Pipeline(StreamOf(1, 2, 3, 4), AcceptOdd)
	for v := range piped {
		println(v)
	}
	// Output:
	// 1
	// 3
}
```

As expected, we only see the odd numbers in the console. The `for` range loop over `piped` acts as a terminal operator, similar to `forEach` in Java Streams. Let's create a helper function for this terminal operator.

## Terminal Operator

We can define a terminal operator function to handle output:

```go
func main() {  
    piped := Pipeline(StreamOf(1, 2, 3, 4), AcceptOdd)  
    ForEach(piped)  
    // Output:  
    // 1    
    // 3
}  
  
func ForEach[T any](in <-chan T) {  
    for v := range in {  
       println(v)  
    }  
}
```

`ForEach` is the final operator that follows this `TerminalOperator` type signature:

```go
type TerminalOperator[T any] func(<-chan T)
```

At this point, we have implemented all components: the Stream Creator, Operators, and the Terminal Operator.

## Generalizing the Filter Operator

Let's go back to the `AcceptOdd` operator. This operator has hardcoded logic to filter only odd numbers from the stream. If we decide to filter even numbers, we would create something like this:

```go
func AcceptEven(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range in {
			if v%2 == 0 {
				out <- v
			}
		}
	}()
	return out
}
```

The difference between `AcceptOdd` and `AcceptEven` is only in the `if` statement that checks if the stream value meets the condition. In programming terms, a function that checks whether a value meets a certain condition is called a predicate. So, let's refactor this into a more generic filter function:

```go
// Predicate is a function that checks if a condition is satisfied.
type Predicate[T any] func(T) bool

// Filter filters out items from the input stream that do not satisfy the predicate p.
func Filter[T any](p Predicate[T]) Operator[T] {
	return func(in <-chan T) <-chan T {
		out := make(chan T)
		go func() {
			defer close(out)
			for v := range in {
				if p(v) {
					out <- v
				}
			}
		}()
		return out
	}
}
```

With this setup, we can now filter both odd and even numbers dynamically:

```go
// IsOdd is a predicate that checks if a number is odd.
func IsOdd(n int) bool { return n%2 == 1 }

// IsEven is a predicate that checks if a number is even.
func IsEven(n int) bool { return n%2 == 0 }

func main() {
	odds := Pipeline(StreamOf(1, 2, 3, 4), Filter(IsOdd))
	ForEach(odds)
	// Output:
	// 1
	// 3
	evens := Pipeline(StreamOf(1, 2, 3, 4), Filter(IsEven))
	ForEach(evens)
	// Output:
	// 2
	// 4
}
```

Notice that we created `StreamOf(1, 2, 3, 4)` twice. This is because the input stream, like water in a bucket, is emptied once piped.

## Implementing a Map Operator

The `Filter` function filters some values before passing them to the next operator. The `Map` function, on the other hand, transforms all values in the stream. Instead of taking a `Predicate`, `Map` takes a `Transform` function:

```go
// Transform transforms the input stream using the transform function.
type Transform[T any] func(T) T

// Map applies the transform function to each item in the input stream.
func Map[T any](transform Transform[T]) Operator[T] {
	return func(in <-chan T) <-chan T {
		out := make(chan T)
		go func() {
			defer close(out)
			for v := range in {
				out <- transform(v)
			}
		}()
		return out
	}
}
```

A `Transform` function can transform values of the same type or even a new type, but we'll keep it simple for this example.

Both `Map` and `Filter` functions follow a similar structure; the only difference is in the inner loop. `Map` calls `transform` on all values before sending them to the next operator. Let's try this out:

```go
func Triple(e int) int    { return e * 3 }
func Successor(e int) int { return e + 1 }

func main() {
	piped := Pipeline(
		StreamOf(1, 2, 3, 4, 5),
		Filter(IsOdd),
		Map(Triple),
		Map(Successor),
	)
	ForEach(piped)
	// Output:
	// 4
	// 10
	// 16
}
```

We have implemented similar behavior to Java Streams, covering everything needed for the pipeline pattern. Let's add one more operator to handle cancellation using a context.

## Context-Aware Pipeline

In our current implementation, the stream closes automatically once all values are emitted. However, if we replace the source stream with something unbounded, as discussed in the Generator pattern, there's no built-in way to gracefully cancel the pipeline. To handle this, we can leverage Go's `context` package.

Since any stage of the pipeline—whether it's the Stream Creator, an Operator, or the Terminal Operator—might need to be canceled, we'll add a `context.Context` as the first argument to each component. We'll then use a `select` statement to either wait for the context to be done or process data from the source stream, whichever happens first.

Here’s how you can update the pipeline to be context-aware:

```diff
diff --git a/pipeline/pipeline.go b/pipeline/pipeline.go  
index 8267aa1..1c01c95 100644  
--- a/pipeline/pipeline.go  
+++ b/pipeline/pipeline.go  
@@ -1,15 +1,17 @@  
 package main  
   
 import (  
+   "context"  
    "fmt"  
+   "time"  
 )  
   
 type (  
    // Operator does some operation on the input stream before passing it to the output stream.  
-   Operator[T any] func(in <-chan T) (out <-chan T)  
+   Operator[T any] func(ctx context.Context, in <-chan T) (out <-chan T)  
   
    // TerminalOperator consumes the data from the input stream one at a time.  
-   TerminalOperator[T any] func(in <-chan T)  
+   TerminalOperator[T any] func(ctx context.Context, in <-chan T)  
 )  
   
 var _ Transform[int] = Triple  
@@ -20,24 +22,33 @@ func Triple(e int) int { return e * 3 }  
 func Successor(e int) int { return e + 1 }  
   
 func main() {  
+   ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)  
+   defer cancel()  
+  
    piped := Pipeline(  
-      StreamOf(1, 2, 3, 4, 5),  
+      ctx,  
+      StreamOf(ctx, 1, 2, 3, 4, 5),  
+      Delay[int](50*time.Millisecond),  
       Filter(IsOdd),  
       Map(Triple),  
       Map(Successor),  
    )  
-   ForEach(piped)  
-   // Output:  
+   ForEach(ctx, piped)  
+   // Output: (close order may vary)  
    // 4  
    // 10  
-   // 16  
+   // Filter: closed  
+   // StreamOf: closed  
+   // Map: closed  
+   // Map: closed  
+   time.Sleep(time.Second)  
 }  
   
 // Pipeline creates a pipeline of operators to process the input stream.  
-func Pipeline[T any](source <-chan T, operators ...Operator[T]) <-chan T {  
+func Pipeline[T any](ctx context.Context, source <-chan T, operators ...Operator[T]) <-chan T {  
    stream := source  
    for _, operator := range operators {  
-      stream = operator(stream)  
+      stream = operator(ctx, stream)  
    }  
    return stream  
 }  
@@ -45,14 +56,14 @@ func Pipeline[T any](source <-chan T, operators ...Operator[T]) <-chan T {  
 // Ensure that ForEach follows the TerminalOperator signature.  
 var _ TerminalOperator[any] = ForEach  
   
-func ForEach[T any](in <-chan T) {  
+func ForEach[T any](ctx context.Context, in <-chan T) {  
    for v := range in {  
       println(v)  
    }  
 }  
   
 // StreamOf creates a stream of items of type T.  
-func StreamOf[T any](seq ...T) <-chan T {  
+func StreamOf[T any](ctx context.Context, seq ...T) <-chan T {  
    stream := make(chan T)  
    go func() {  
       defer func() {  
@@ -60,7 +71,12 @@ func StreamOf[T any](seq ...T) <-chan T {  
          fmt.Println("StreamOf: closed")  
       }()  
       for _, item := range seq {  
-         stream <- item  
+         select {  
+         case <-ctx.Done():  
+            return  
+         case stream <- item:  
+         }  
+  
       }  
    }()  
    return stream  
@@ -71,12 +87,19 @@ type Transform[T any] func(T) T  
   
 // Map applies the transform function to each item in the input stream.  
 func Map[T any](transform Transform[T]) Operator[T] {  
-   return func(in <-chan T) <-chan T {  
+   return func(ctx context.Context, in <-chan T) <-chan T {  
       out := make(chan T)  
       go func() {  
-         defer close(out)  
+         defer func() {  
+            close(out)  
+            fmt.Println("Map: closed")  
+         }()  
          for v := range in {  
-            out <- transform(v)  
+            select {  
+            case <-ctx.Done():  
+               return  
+            case out <- transform(v):  
+            }  
          }  
       }()  
       return out  
@@ -88,13 +111,20 @@ type Predicate[T any] func(T) bool  
   
 // Filter filters out items from the input stream that do not satisfy the predicate p.  
 func Filter[T any](p Predicate[T]) Operator[T] {  
-   return func(in <-chan T) <-chan T {  
+   return func(ctx context.Context, in <-chan T) <-chan T {  
       out := make(chan T)  
       go func() {  
-         defer close(out)  
+         defer func() {  
+            close(out)  
+            fmt.Println("Filter: closed")  
+         }()  
          for v := range in {  
             if p(v) {  
-               out <- v  
+               select {  
+               case <-ctx.Done():  
+                  return  
+               case out <- v:  
+               }  
             }  
          }  
       }()  
@@ -110,3 +140,26 @@ func IsOdd(n int) bool { return n%2 == 1 }  
   
 // IsEven is a predicate that checks if a number is even.  
 func IsEven(n int) bool { return n%2 == 0 }  
+  
+// Delay delays the emission of items from the input stream by d duration.  
+func Delay[T any](d time.Duration) Operator[T] {  
+   return func(ctx context.Context, in <-chan T) (out <-chan T) {  
+      stream := make(chan T)  
+      go func() {  
+         defer close(stream)  
+         for {  
+            select {  
+            case <-ctx.Done():  
+               return  
+            case <-time.After(d):  
+               select {  
+               case <-ctx.Done(): // recheck deadline after delay.  
+                  return  
+               case stream <- <-in:  
+               }  
+            }  
+         }  
+      }()  
+      return stream  
+   }  
+}
```

Additionally, there's a new operator called `Delay`, which delays the emission of items from the input stream by a specified duration.

And there you have it! You've successfully implemented a flexible and powerful concurrency pattern in Go using channels and goroutines, achieving a behavior similar to Java Streams. With this knowledge, you're ready to build more complex pipelines for your data processing needs in Go.

## Conclusion

In this article, we explored the Pipeline pattern in Go, which allows for step-by-step data processing through a series of operators, much like Java Streams. We started with a basic pipeline, including a Stream Creator, Operators, and a Terminal Operator. We then enhanced the pipeline with context-awareness, enabling graceful cancellation of unbounded streams.

By leveraging Go's concurrency features, we created a flexible pipeline that supports various operators like `Filter`, `Map`, and `Delay`. Adding context-awareness ensures that pipelines can handle cancellation smoothly, making them suitable for a wide range of use cases.

With this approach, you can build efficient and adaptable data processing pipelines in Go.

> You can the full code in this GitHub repository for more insights. 
> [Go Concurrency Patterns: Pipeline](https://github.com/josestg/yt-go-concurrency-patterns/tree/main/pipeline)

## What’s Next?

This article is part of a series on Go Concurrency Patterns. In the next article, we will explore the [**Fan-Out and Fan-In**](/posts/concurrency-patterns/go-concurrency-patterns-fan-out-fan-in/) pattern, which is crucial for distributing workloads across multiple goroutines and then aggregating their results. This pattern is especially useful when you need to parallelize tasks and improve performance by utilizing multiple cores effectively.

Stay tuned for more articles in this series to deepen your understanding of Go's concurrency patterns and enhance your Go programming skills!