+++
date = '2023-10-22T03:15:57+07:00'
draft = false
title = 'Exploring Internal Implementation of Go Slice'
author = ["Jose Sitanggang"]
tags = ["golang", "slice", "data-structure", "c++"]
description = "Understanding how slices work in Go on a deeper level, by implementing it in C++."
+++

This blog is based on what I learned from reading the "[Go Slices: Usage and Internals](https://go.dev/blog/slices-intro)" blog post.

When I read that blog post, I got curious and wanted to create my own version of a slice in a low-level language like C++. I wanted to understand how slices work in Go on a deeper level. I also wanted to confirm something mentioned in the Go Documentation they say that: slices are always passed by value, but they don't copy all the data. Instead, they only pass a small piece of information called the [SliceHeader](https://pkg.go.dev/reflect#SliceHeader), which is just 24 bytes long. This understanding made me realize that both an empty slice and a slice with a million items have the same size, which is the size of the [SliceHeader](https://pkg.go.dev/reflect#SliceHeader).

Let's take a look at the [SliceHeader](https://pkg.go.dev/reflect#SliceHeader) definition:

```go
type SliceHeader struct {
    Data uintptr
    Len  int
    Cap  int
}
```

We can model this in C++ as follows:

```cpp
typedef struct Slice {
    int* data;
    int len;
    int cap;
} Slice;
```

For simplicity, we don't use the `template` so we can only use `int` as the data type for the slice items.

The `data` field is a pointer to the backing array, which is a fixed-size array that stores the items. The `len` field is the number of items that the slice currently holds, and the `cap` field is the actual size of the backing array or the maximum number of items that the slice can hold.

In Go, we use the built-in `make` function to create a slice. We can model this in C++ as follows:

```cpp
// Create a slice of length len and capacity cap.
Slice make(int len, int cap) {
  if (len > cap) {
    throw std::runtime_error("make: len > cap");
  }

  // make sure the capacity is at least 1 and the length is at least 0.
  len = std::max(len, 0);
  cap = std::max(cap, 1);

  // create a contiguous block of memory as the backing array for
  // storing the actual data.
  int *backing_array = (int *) calloc(cap, sizeof(int));
  if (backing_array == nullptr) {
    throw std::runtime_error("make: out of memory");
  }

  return {.data = backing_array, .len = len, .cap = cap};
}
```

In high-level terms, the `make` function ensures that the capacity is at least 1 and allocates a backing array with a size equal to the specified capacity.

The backing array is a contiguous block of memory that stores the actual data. This backing array is allocated using the `calloc` function, which is similar to the `malloc` function but also initializes the allocated memory to zero. This initialization is necessary because we want to initialize the backing array with the default value of the data type, which is zero for integers.

Since we are using `calloc`, we need to use `free` to deallocate the backing array when we are done using it. In Go, we don't need to worry about this because Go has a built-in garbage collector that automatically deallocates unused memory. However, in C++, we need to perform this deallocation manually. Let's create a function for it:
```cpp
// Deallocate the backing array.
void free_slice(Slice &s) {
    // free is a built-in function in C++ to deallocate memory.
    free(s.data); 
}
```

To access or modify the items in the slice, we can create setter and getter functions as follows:

```cpp
// Set the value at given index.
void set_value(Slice &s, int index, int value) {
  if (index < 0 || index >= s.len) {
    throw std::out_of_range("set_value: index out of range");
  }
  // setting the value by using pointer arithmetic.
  *(s.data + index) = value;
}

// Get the value at given index.
int get_value(const Slice &s, int index) {
  if (index < 0 || index >= s.len) {
    throw std::out_of_range("get_value: index out of range");
  }
  // getting the value by using pointer arithmetic.
  return *(s.data + index);
}
```
Actually, C++ allows us to overload the `[]` operator, but for now, let's keep it simple.

Please note that for `set_value`, it takes a reference (`Slice&`), and for `get_value`, it takes a read-only reference (`const Slice&`). I do this intentionally to ensure that reading a value does not have any side effects. This is a good practice in general.

The next function is the `append` function. In Go, we use the built-in `append` function to add a new element to the slice. To model this in C++, we need to understand the Dynamic Array resizing algorithm, which is very straightforward.

The algorithm is as follows:

1. If the length is equal to the capacity:
   - Allocate a new backing array with a larger size (normally 2 times the current capacity).
   - Copy all the items from the old backing array to the new backing array.
   - Replace the old backing array with the new backing array.
   - Update the capacity to the size of the new backing array.
   - Set the new value at the end of the slice.
2. Otherwise, set the new value at the end of the slice.
3. Increase the length by 1.

Let's see how we implement this in C++:

```cpp
// Append a new element to the slice.
Slice append(Slice s, int v) {
  if (s.len == s.cap) {
    // grow the backing array by 2x or 1 if the capacity is 0.
    int new_cap = std::max(2 * s.cap, 1);
    // reallocate basically creates a new contiguous block of memory
    // with the new capacity and copies the data from the old block to
    // the new block.
    int *new_backing_array = (int *) realloc(s.data, new_cap * sizeof(int));
    if (new_backing_array == nullptr) {
      throw std::runtime_error("grow: out of memory");
    }
    // move the pointer to the new backing array.
    s.data = new_backing_array;
    // update the capacity.
    s.cap = new_cap;
  }
  s.len++;
  set_value(s, s.len - 1, v); // set the value at the end of the slice.
  return s;
}
```
The `Append` function takes a copy of the `Slice` or the `SliceHeader` in Go and checks if there is still room for a new element. If not, it allocates a new larger backing array and copies all the data into the newly allocated backing array. According to [this documentation](https://github.com/golang/go/blob/master/src/runtime/slice.go#L270-L272), slice growth can be either 2x or 1.25x. For simplicity, a new backing array will always grow to 2x the previous capacity.

For allocating the new backing array, we can use `calloc`, but by using `realloc`, we don't need to manually copy the data from the old backing array to the new backing array. This is because `realloc` will do it for us.

And that's it! We have successfully implemented a slice in C++. To make it easier for demonstration, let's create a few helper functions to print the slice representation.

```cpp
std::string to_string(const Slice &s) {
  std::stringstream stream;
  stream << "[";
  for (int i = 0; i < s.len; i++) {
    stream << get_value(s, i);
    if (i != s.len - 1) {
      stream << ", ";
    }
  }
  stream << "]";
  return stream.str();
}

std::ostream &operator<<(std::ostream &os, const Slice &s) {
  os << "Slice{"
        " .len="  << s.len <<
        " .cap="  << s.cap <<
        " .data=" << to_string(s)
     << " }";
  return os;
}
```
The `to_string` function will create a string representation of the slice data as we are already familiar with in Go, like `[1, 2, 3]`. The `operator<<` function is an operator overloading function that will be called when we print the slice using `std::cout`.

Now, let's examine this implementation in action:

```cpp
int main() {
  Slice s = make(0, 1);
  std::cout << "slice created: " << s << std::endl;
  std::cout << "size of slice: " << sizeof(s) << std::endl;

  int last_cap = s.cap;
  for (int i = 0; i < 10; i++) {
    std::cout << "append value: " << i << std::endl;
    s = append(s, i);
    if (s.cap != last_cap) {
      std::cout << "slice capacity changed: " << s << std::endl;
      last_cap = s.cap;
    }
  }

  std::cout << "slice: " << s << std::endl;

  std::cout << "updating slice[0] to 100" << std::endl;
  set_value(s, 0, 100);

  std::cout << "slice after update: " << s << std::endl;
  std::cout << "size of slice: " << sizeof(s) << std::endl;
  free_slice(s);
  return 0;
}
```

The output will be:

```shell
slice created: Slice{ .len=0 .cap=1 .data=[] }
size of slice: 16
append value: 0
append value: 1
slice capacity changed: Slice{ .len=2 .cap=2 .data=[0, 1] }
append value: 2
slice capacity changed: Slice{ .len=3 .cap=4 .data=[0, 1, 2] }
append value: 3
append value: 4
slice capacity changed: Slice{ .len=5 .cap=8 .data=[0, 1, 2, 3, 4] }
append value: 5
append value: 6
append value: 7
append value: 8
slice capacity changed: Slice{ .len=9 .cap=16 .data=[0, 1, 2, 3, 4, 5, 6, 7, 8] }
append value: 9
slice: Slice{ .len=10 .cap=16 .data=[0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
updating slice[0] to 100
slice after update: Slice{ .len=10 .cap=16 .data=[100, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
size of slice: 16
```

By tracing the output, we can observe a few things:

1. The size of the slice, whether it is empty or contains values, is always 16 bytes long, which is the same as the size of the `Slice` struct or the `SliceHeader` in Go.
2. The capacity will double in size based on the initial capacity, meaning that if we provide a larger capacity when creating the slice, we can reduce the frequency of the growing process.
3. When passing a `Slice` as a value, it copies the `Slice`, but the `Data` pointer always points to the backing array. This is why even if we modify the copied `Slice`, the other copies of the `Slice` will have the same effect. This behavior is also observed in Go.

The implementation above is a simplified representation of a slice in C++. In reality, the implementation is more complex than what we've covered here. However, I hope this article has provided you with a better understanding of how slices work in Go. 

You might have noticed that copying all items from the old backing array to the new backing array might seem expensive and inefficient, but it actually takes **O(1)** time. If you're curious about how this is achieved in constant time, you can read my other article titled "[How Can Adding a New Item to a Dynamic Array Be Achieved in Constant Time?](/posts/math/how-can-adding-a-new-item-to-a-dynamic-array-be-achieved-in-constant-time/)".

That's all for now. I hope you've enjoyed this blog post. If you have any questions or suggestions, please feel free to leave a comment below. Thank you for reading!