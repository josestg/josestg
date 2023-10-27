+++
title = 'Boosting String and Bytes Conversions Speed by 140x with Zero Allocation in Go'
date = '2023-10-21T03:04:14+07:00'
draft = false
author = "Jose Sitanggang"
tags = ['golang', 'slice', 'optimization']
description = "Enhancing Performance and Memory Efficiency in String to Bytes Conversions and Vice Versa."
[cover]
hiden = false
image = "/images/golang.png"
alt = "Golang Logo"
caption = "Image by [ositcom.com](https://ositcom.com/)"
+++


Converting between a string and bytes requires allocating new memory. However, strings and bytes (which are essentially slices of bytes) share a similar memory structure. The main difference is that a slice can grow as needed, while a string remains immutable. We can gain insights into their internal structures by referring to the Go documentation. Strings are defined using [StringHeader](https://pkg.go.dev/reflect#StringHeader), while slices are defined using [SliceHeader](https://pkg.go.dev/reflect#SliceHeader). To enhance clarity, we'll include these definitions here:

```go
type SliceHeader struct {
 Data uintptr
 Len  int
 Cap  int
}

type StringHeader struct {
 Data uintptr
 Len  int
}
```

The `Data` field represents the memory address of the first item in the backing array, which is where the data is stored. The backing array has a fixed size since it is allocated, which is why a slice has a capacity (`Cap`) to allow it to grow when more space is needed to store new data. If you are interested in learning how a slice grows, please refer to my article titled "**[Exploring Go Slice Internal Implementation in C++](https://josestg.com/blog/exploring-slice-internal-implementation-go)**."


To convert a slice of bytes to a string, we simply need to remove the Cap field and move the data pointer in `SliceHeader` to the Data field in `StringHeader`. How can we do that? Go doesn't allow us to manage memory manually as we do in C and C++. However, there is a package called [unsafe](https://pkg.go.dev/unsafe). This is a special package in Go that allows us to manage memory manually, but it's essential to remember that, in most cases, we should avoid doing this unless you require very high performance and are aware of the risks like [Use After Free](https://owasp.org/www-community/vulnerabilities/Using_freed_memory).


```go
// BytesToString converts bytes to a string without memory allocation.
// NOTE: The given bytes MUST NOT be modified since they share the same backing array
// with the returned string.
func BytesToString(b []byte) string {
	// Obtain SliceHeader from []byte.
	sliceHeader := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	// Construct StringHeader from SliceHeader.
	stringHeader := reflect.StringHeader{Data: sliceHeader.Data, Len: sliceHeader.Len}

	// Convert StringHeader to a string.
	s := *(*string)(unsafe.Pointer(&stringHeader))
	return s
}
```

Since both the `SliceHeader` and `StringHeader` are now deprecated, we can use a simpler version as suggested by the Go documentation:

```go
func BytesToString(b []byte) string {
	// Ignore if your IDE shows an error here; it's a false positive.
	p := unsafe.SliceData(b)
	return unsafe.String(p, len(b))
}
```

We can apply the same concept to convert a string into a slice of bytes by specifying the `Cap` field in the `SliceHeader`. Please note that we must set the capacity to be equal to the length of the string to prevent buffer overflow when the slice grows after the conversion. This is necessary because there is a possibility that the next address of the backing array is already occupied by another process due to the characteristics of contiguous memory allocation. Let's take a look at the code below:

```go
// StringToBytes converts a string to a byte slice without memory allocation.
// NOTE: The returned byte slice MUST NOT be modified since it shares the same backing array
// with the given string.
func StringToBytes(s string) []byte {
	// Get StringHeader from string
	stringHeader := (*reflect.StringHeader)(unsafe.Pointer(&s))

	// Construct SliceHeader with capacity equal to the length
	sliceHeader := reflect.SliceHeader{Data: stringHeader.Data, Len: stringHeader.Len, Cap: stringHeader.Len}

	// Convert SliceHeader to a byte slice
	return *(*[]byte)(unsafe.Pointer(&sliceHeader))
}
```

or in simpler version:

```go
func StringToBytes(s string) []byte {
	p := unsafe.StringData(s)
	b := unsafe.Slice(p, len(s))
	return b
}
```

To demonstrate that there is no allocation, let's do some benchmarks.

- The `BenchmarkStringToBytesStandard` benchmark involves conversion using `[]byte("string")`.
- The `BenchmarkBytesToStringStandard` benchmark involves conversion using `string([]byte{'b', 'y', 't', 'e'})`.
- The `BenchmarkStringToBytes` and `BenchmarkStringToBytes` benchmarks use the unsafe conversion method.

```shell
➜  zerocast git:(main) go test -run=xxx -bench=.  ./...

goos: darwin
goarch: arm64
pkg: github.com/josestg/zerocast
BenchmarkStringToBytesStandard-10       17584456                 58.21  ns/op          512 B/op          1 allocs/op
BenchmarkBytesToStringStandard-10       21287950                 55.13  ns/op          512 B/op          1 allocs/op
BenchmarkStringToBytes-10               1000000000               0.3928 ns/op          0   B/op          0 allocs/op
BenchmarkStringToBytes-10               1000000000               0.3920 ns/op          0   B/op          0 allocs/op
PASS
ok      github.com/josestg/zerocast     3.541s
```

As we can see, both `BenchmarkStringToBytes` and `BenchmarkStringToBytes` show no allocation, and the `ns/op` has also improved to be approximately 140 times faster.

You can find the code in [this GitHub repository](https://github.com/josestg/zerocast). If you have any questions, please feel free to ask in the comment section below. Thank you!