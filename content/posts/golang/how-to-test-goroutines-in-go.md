+++
title = 'How to Test Goroutines in Go'
date = '2024-04-09T21:19:52.255+07:00'
draft = false
author = "Jose Sitanggang"
tags = ['golang', 'goroutines', 'testing']
description = "Testing goroutines in Go can be challenging because they execute in a random order. Learn how to test goroutines in Go using just the standard library."
+++

Goroutines are one of the most powerful features in Go. They allow us to run tasks concurrently and are also lightweight compared to threads. However, testing goroutines can be challenging because they execute in a random order. Sometimes, the test may finish before the goroutine completes, causing the test to fail intermittently. In this article, we'll explore how to test goroutines in Go using just the standard library.

Let's consider this simple example:

```go
// task_runner.go
type Task func(ctx context.Context, args []string)

type TaskRunner struct {
	log   *slog.Logger
	tasks []Task
}

func NewTaskRunner(l *slog.Logger, tasks ...Task) *TaskRunner {
	return &TaskRunner{log: l, tasks: tasks}
}

func (r *TaskRunner) Run(ctx context.Context, args []string) {
	r.log.InfoContext(ctx, "Run tasks", "args", args)
	ctx = context.WithoutCancel(ctx)
	for _, task := range r.tasks {
		go task(ctx, args)
	}
}
```

The `Run` methods run tasks concurrently and then forget about them. This kind of problem is often found in real-world applications. For example, when sending emails to multiple recipients, using goroutines allows us to send the emails concurrently, making the process faster.

While the code appears to be correct, how can we test it? Let's first write a test for it without synchronization, and then observe the problem.

```go
// task_runner_test.go

func NewTask(l *slog.Logger, name string) Task {
	return func(ctx context.Context, args []string) {
        l.InfoContext(ctx, "Task started", "name", name)
		delay := time.Duration(rand.Intn(10)*100) * time.Millisecond
		select {
		case <-ctx.Done():
			l.InfoContext(ctx, "Task canceled", "name", name)
		case <-time.After(delay): // simulate some work.
			l.InfoContext(ctx, "Task finished", "name", name, "args", args)
		}
	}
}

func TestTaskRunner_Run(t *testing.T) {
	var logHistory bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logHistory, &slog.HandlerOptions{}))
	defer func() { t.Log(logHistory.String()) }()

	task1 := NewTask(logger, "task1")
	task2 := NewTask(logger, "task2")
	task3 := NewTask(logger, "task3")

	runner := NewTaskRunner(logger, task1, task2, task3)

	ctx := context.Background()
	args := []string{"a", "b", "c"}
	runner.Run(ctx, args)
}
```

The test is very straightforward. We create a `Task` constructor to create a task with a delay to simulate some work. The returned task will block until the context is canceled or the delay is finished. We create three tasks and run them concurrently using the `Run` method.

If you run the test, you will find that some logs are missing. This is what I got (results may vary):

```shell
=== RUN   TestTaskRunner_Run
    async_event_test.go:28: time=2024-04-09T21:19:52.255+07:00 level=INFO msg="Run tasks" args="[a b c]"
        
--- PASS: TestTaskRunner_Run (0.00s)
PASS
```


I have two solutions to solve this problem. Let's see which one is better for your case.

## First Approach: Using `sync.WaitGroup` and Mocking the `Task`

The first approach is to use `sync.WaitGroup` and mock the `Task` function. Since we can inject the task into the `TaskRunner`, we can fully control the task's behavior.

We modify the `NewTask` function to accept `sync.WaitGroup` as the third argument. Additionally, we add `wg.Done()` at the end of the task function to notify that the task has finished. We also modify the test to use `sync.WaitGroup` to wait for all tasks to finish. 

Here is the git diff:

```diff
diff --git a/how-to-test-goroutines/task_runner_test.go b/how-to-test-goroutines/task_runner_test.go
index aeac6a6..4e8b96d 100644
--- a/how-to-test-goroutines/task_runner_test.go
+++ b/how-to-test-goroutines/task_runner_test.go
@@ -5,12 +5,15 @@ import (
"context"
"log/slog"
"math/rand"
+	"sync"
"testing"
"time"
)

-func NewTask(l *slog.Logger, name string) Task {
+func NewTask(l *slog.Logger, name string, wg *sync.WaitGroup) Task {
return func(ctx context.Context, args []string) {
+		defer wg.Done()
+
l.InfoContext(ctx, "Task started", "name", name)
delay := time.Duration(rand.Intn(5)*100) * time.Millisecond
select {
@@ -26,13 +29,18 @@ func TestTaskRunner_Run(t *testing.T) {
logger := slog.New(slog.NewTextHandler(&logHistory, &slog.HandlerOptions{}))
defer func() { t.Log(logHistory.String()) }()

-	task1 := NewTask(logger, "task1")
-	task2 := NewTask(logger, "task2")
-	task3 := NewTask(logger, "task3")
+	var wg sync.WaitGroup
+	wg.Add(3)
+
+	task1 := NewTask(logger, "task1", &wg)
+	task2 := NewTask(logger, "task2", &wg)
+	task3 := NewTask(logger, "task3", &wg)

runner := NewTaskRunner(logger, task1, task2, task3)

ctx := context.Background()
args := []string{"a", "b", "c"}
runner.Run(ctx, args)
+
+	wg.Wait()
}
```

If you run the test, you will see that all logs are printed. This is what I got:

```shell
=== RUN   TestTaskRunner_Run
    task_runner_test.go:30: time=2024-04-09T21:44:58.959+07:00 level=INFO msg="Run tasks" args="[a b c]"
        time=2024-04-09T21:44:58.959+07:00 level=INFO msg="Task started" name=task3
        time=2024-04-09T21:44:58.959+07:00 level=INFO msg="Task started" name=task1
        time=2024-04-09T21:44:58.959+07:00 level=INFO msg="Task started" name=task2
        time=2024-04-09T21:44:59.060+07:00 level=INFO msg="Task finished" name=task1 args="[a b c]"
        time=2024-04-09T21:44:59.060+07:00 level=INFO msg="Task finished" name=task3 args="[a b c]"
        time=2024-04-09T21:44:59.060+07:00 level=INFO msg="Task finished" name=task2 args="[a b c]"
        
--- PASS: TestTaskRunner_Run (0.10s)
PASS
```

## Second Approach: Using `context.Context` and `sync.WaitGroup`

I was happy with the first approach since, in most cases, we have full control of the task, and that's the beauty of dependency injection. However, sometimes we don't have control over the task, or perhaps we simply don't want to mock the task itself. In such cases, we can utilize the `context.Context` and `sync.WaitGroup` to enable/disable synchronization contextually.

In the first approach, we heavily expose the synchronization mechanism in the test code. In the second approach, we encapsulate the synchronization mechanism within the `TaskRunner` itself. We create a new package called `await` to handle the synchronization. The `await` package will provide a way to add and wait for the task to finish. The only change we need in the test code is to wrap `context.Background()` with `await.Context()`. 

Here is the git diff:

```diff
diff --git a/how-to-test-goroutines/task_runner.go b/how-to-test-goroutines/task_runner.go
index 4e73a49..5cc8036 100644
--- a/how-to-test-goroutines/task_runner.go
+++ b/how-to-test-goroutines/task_runner.go
@@ -3,6 +3,8 @@ package how_to_test_goroutines
 import (
 	"context"
 	"log/slog"
+
+	"github.com/josestg/gotips/how-to-test-goroutines/await"
 )
 
 type Task func(ctx context.Context, args []string)
@@ -19,7 +21,15 @@ func NewTaskRunner(l *slog.Logger, tasks ...Task) *TaskRunner {
 func (r *TaskRunner) Run(ctx context.Context, args []string) {
 	r.log.InfoContext(ctx, "Run tasks", "args", args)
 	ctx = context.WithoutCancel(ctx)
+
+	awaiter := await.FromContext(ctx)
 	for _, task := range r.tasks {
-		go task(ctx, args)
+		awaiter.Add(1)
+		task := task
+		go func() {
+			defer awaiter.Done()
+			task(ctx, args)
+		}()
 	}
+	awaiter.Wait()
 }
diff --git a/how-to-test-goroutines/task_runner_test.go b/how-to-test-goroutines/task_runner_test.go
index aeac6a6..b1cf9a7 100644
--- a/how-to-test-goroutines/task_runner_test.go
+++ b/how-to-test-goroutines/task_runner_test.go
@@ -7,6 +7,8 @@ import (
 	"math/rand"
 	"testing"
 	"time"
+
+	"github.com/josestg/gotips/how-to-test-goroutines/await"
 )
 
 func NewTask(l *slog.Logger, name string) Task {
@@ -33,6 +35,7 @@ func TestTaskRunner_Run(t *testing.T) {
 	runner := NewTaskRunner(logger, task1, task2, task3)
 
 	ctx := context.Background()
+	ctx = await.Context(ctx)
 	args := []string{"a", "b", "c"}
 	runner.Run(ctx, args)
 }
```

It seems like we have changed the expectation. Previously, we wanted the task to fire and forget, but now we are making it wait for all tasks to finish, which is blocking. However, this behavior depends on the value in the context. To gain a better understanding, let's examine the `await` package:

```go
// await/await.go
type contextKey struct{}

var awaitKey = &contextKey{}

// Awaiter basically an interface that describes the sync.WaitGroup.
type Awaiter interface {
	Add(delta int)
	Done()
	Wait()
}

// nopAwaiter is a no-op implementation of Awaiter.
type nopAwaiter struct{}

func (nopAwaiter) Add(_ int) {}
func (nopAwaiter) Done()     {}
func (nopAwaiter) Wait()     {}

// Context returns a new context with an Awaiter.
func Context(ctx context.Context) context.Context {
	var wg Awaiter = &sync.WaitGroup{}
	return context.WithValue(ctx, awaitKey, wg)
}

// FromContext returns the Awaiter from the context if it exists. Otherwise, it returns a no-op Awaiter.
func FromContext(ctx context.Context) Awaiter {
	wg, ok := ctx.Value(awaitKey).(Awaiter)
	if !ok {
		return &nopAwaiter{}
	}
	return wg
}
```

The secret recipe lies in the `FromContext` function. When the context doesn't have the `Awaiter`, it returns a no-op `Awaiter`. Since our default expectation is to fire and forget the task, and we only require synchronization in the test, we change the context's behavior to wait for all tasks to finish using `await.Context()` in the test.

Because we need more than one behavior depending on the context, this is where interfaces shine. By creating an interface `Awaiter` that describes the synchronization mechanism, we can easily switch the behavior of the `TaskRunner` by just changing the context value.

And that's it!

## Conclusion

Personally, I prefer the second approach because it encapsulates the synchronization mechanism in the business logic rather than exposing it in the test code. However, it depends on the case. Sometimes the first approach is more suitable. The key takeaway is to understand the problem and choose the best solution for it. I hope this article helps you to test goroutines in Go. If you have any questions or suggestions, feel free to leave a comment below. Thank you for reading!

You can find the complete code in the [GitHub repository](https://github.com/josestg/gotips/tree/main/how-to-test-goroutines)