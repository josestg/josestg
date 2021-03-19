---
title: Graceful Shutdown dengan Golang
intro: Dalam membuat aplikasi backend (misalnya REST API) terkadang kita tidak berpikir apa yang akan terjadi apabila aplikasi kita shutdown secara tiba-tiba, atau shutdown karena disengaja. Padahal, saat itu aplikasi kita sedang mengerjakan suatu request.
dateCreated: 13 Mar 2021
useLatex: false
categories:
  - Go
  - RESTful API
---


Dalam membuat aplikasi backend (misalnya REST API) terkadang kita tidak berpikir apa yang akan terjadi apabila aplikasi kita shutdown secara tiba-tiba, atau shutdown karena disengaja. Padahal, saat itu aplikasi kita sedang mengerjakan suatu request.

Mungkin agar lebih jelas, coba kita perhatikan source code berikut.

```go
// main.go
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}

}

func hello(rw http.ResponseWriter, r *http.Request) {
	// Membuat random ID untuk setiap request
	requestID := time.Now().UnixNano() % time.Now().Unix()

	fmt.Printf("Start requestID: %d\n", requestID)
	defer fmt.Printf("Done requestID: %d\n", requestID)

	// Mensimulasikan proses lambat.
	time.Sleep(5 * time.Second)

	io.WriteString(rw, "Hello World")
}
```

Jika kita membuat request ke `localhost:8080`,  aplikasi tersebut akan mengembalikan sebuah response `"Hello World"`. 

Sekarang kita akan coba simulasikan aplikasi tersebut dengan digunakan oleh 10 user secara bersamaan, kemudian sebelum semua request selesai dikerjakan, kita akan shutdown aplikasi tersebut dengan dengan menggunakan __Ctrl + C__ (_atau sering disebut Interrupt_).


> Untuk melakukan request secara bersamaan (parallel) kita butuh tool bernama [hey](https://github.com/rakyll/hey)


Untuk mempersingkat, sekarang coba jalankan aplikasi __main.go__ dan buat request menggunakan command berikut:

```bash
$ hey -n 10 -c 5 http://localhost:8080
```

Disini `hey` akan menjalankan 10 buah request dan hanya 5 request yang akan dijalankan secara bersamaan pada satu proses. Artinya, nanti akan terdapat dua kali proses yang akan menjalankan masing-masing 5 request secara bersamaan. 


> __Note:__  Kita sepakati disini, satu proses artinya satu perjalanan request hingga mendapatkan response

Pada saat proses pertama selesai (_5 request pertama mendapatkan response_), cobalah interrupt aplikasi tersebut dan lihat apa yang terjadi.

![Gambar 1: Tidak menggunakan Graceful Shutdown](/images/no-graceful.png)

Jika kita lihat pada gambar diatas, yang terjadi adalah 5 request pada proses kedua tidak akan pernah lagi mendapatkan response, karena aplikasi sudah di-shutdown. Ini sangat bahaya, bayangkan saja apa yang akan terjadi apabila request tersebut adalah sebuah mekanisme pembayaran. Oleh karena itulah ada baiknya kalau kita menerapkan yang namanya __Graceful Shutdown__.

## Gimana cara kerjanya?

Pada implementasi sebelumnya, ketika aplikasi diperintahkan untuk shutdown, maka aplikasi akan langsung menerima perintah tersebut tanpa harus menyelesaikan pekerjaannya terlebih dahulu. Ini berbeda halnya ketika kita menerapkan graceful shutdown, dimana ketika aplikasi menerima perintah untuk shutdown, yang pertama dilakukan adalah menutup semua koneksi sehingga tidak ada request baru yang akan masuk, kemudian aplikasi akan menyelesaikan semua request yang sedang dikerjakan, dan setelah semua request selesai dikerjakan barulah aplikasi akan melakukan shutdown.

## Gimana cara buatnya?

Bersyukur disi kita menggunakan Go, karena semua yang kita butuhkan sudah disediakan oleh standard library. Oke, langsung saja.

-  Pertama, bagaimana cara melakukan shutdown? Caranya cukup mudah yaitu dengan menggunakan method [Shutown](https://pkg.go.dev/net/http#Server.Shutdown)
-  Kedua, bagaimana caranya kita tau kalau aplikasi kita menerima perintah untuk shutdown? Ini juga cukup mudah kita tinggal menggunakan channel dan [signal.Notify](https://pkg.go.dev/os/signal#Notify)

Sekarang kita sudah tahu apa saja yang kita butuhkan, sekarang gimana cara mengimplementasikannya?

Pertama kita akan membuat sebuah channel untuk menerima sebuah signal. Sebelum lebih jauh, ketika kita menekan __Ctrl + C__ di terminal pada saat aplikasi kita sedang jalan, sebenarnya yang terjadi adalah kita memberikan signal [Interrupt](https://en.wikipedia.org/wiki/Interrupt). Maka kita perlu mendaftarkan signal interrupt di [signal.Notify](https://pkg.go.dev/os/signal#Notify), agar ketika ada signal Interrupt - kita akan diberi notifikasi melalui channel.



```go{16,17}
// main.go
func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}

	// shutdownSignal harus merupakan buffered channel.
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt)
}
```

> channel _shutdownSignal_ akan diberikan notifikasi apabila ada signal _os.Interrupt_ yang terjadi.

Tetapi kode diatas masih kurang tepat, karena _server.ListenAndServe_ itu bersifat blocking, sehingga _signal.Nofity_ tidak akan pernah dieksekusi sebelum server di shutdown. Oleh karena itu, kita harus menjalankan _server.ListenAndServe_ di goroutine yang lain, namun error-nya tetap harus dikembalikan ke main goroutine. Caranya cukup mudah, kita hanya perlu membuat goroutine dan sebuah channel untuk menampung error dari _server.ListenAndServe_.

```go{20,21,22,23,24,25}
// main.go
func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	// shutdownSignal harus merupakan buffered channel.
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt)

	select {
	case err := <-serverError:
		if err != nil {
			log.Fatal(err)
		}
	}
}
```

Kita menggunakan _select_ agar main goroutine menjadi blocking hingga ada error yang diterima dari channel _serverError_.

Sekarang kita sudah bisa menjalankan server di sebuah goroutine. Sekarang iyalah bagaimana cara kita bisa mendengarkan signal ? Caranya sama dengan _serverError_, kita hanya perlu membuat _case_ baru seperti berikut:

```go{26,27,28}
// main.go
func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	// shutdownSignal harus merupakan buffered channel.
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt)

	select {
	case err := <-serverError:
		if err != nil {
			log.Fatal(err)
		}

	case sig := <-shutdownSignal:
		log.Println("Shutdown by signal: ", sig)
		server.Shutdown(context.Background())
	}
}
```

> main goroutine akan blocking sampai salah satu dari channel _serverError_ dan channel _shutdownSignal_ menerima data.

Sekarang coba jalankan lagi __main.go__ dan jalankan skenario yang sama seperti sebelumnya, lihat apa yang terjadi. Aplikasi baru akan shutdown ketika semua request yang sedang berjalan sudah selesai dikerjakan.

![Gambar 2: Menggunakan Graceful Shutdown](/images/graceful-shutdown.png)

__Opps__, tunggu dulu. Implementasi diatas masih kurang baik, kita masih punya beberapa masalah, yaitu:

- Bagaimana jika aplikasi kita tidak bisa shutdown? apakah kita harus menunggu selamanya?
- Pada aplikasi dunia nyata, perintah shutdown tidak datang dari user dengan menggunakan __Ctrl + C__, namun bisa jadi datang dari [Load Balancer](https://en.wikipedia.org/wiki/Load_balancing_(computing)) atau sistem lain. Bagaimana cara kita mengatasinya?

Mari kita selesaikan satu per satu.

Yang pertama, coba perhatikan _server.Shutdown_, method tersebut menerima sebuah context sebagai parameter. Karena itu kita bisa gunakan yang namanya _context.WithTimeout_, problem solved 😀.

```go{29,30,31,32,33,34,35}
// main.go
func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	// shutdownSignal harus merupakan buffered channel.
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt)

	select {
	case err := <-serverError:
		if err != nil {
			log.Fatal(err)
		}

	case sig := <-shutdownSignal:
		log.Println("Shutdown by signal: ", sig)

		timeout := 10 * time.Second
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			server.Close()
		}
	}
}
```

Jadi ketika server tidak bisa di-shutdown dalam waktu 10 detik, maka _server.Shutdown_ akan mengembalikan error yang tidak nil. Ketika kita dapat error non nil, maka kita harus shutdown server secara paksa, yaitu dengan menggunakan _server.Close_

Sekarang masalah yang kedua. Misalnya kita gunakan Load Balencer sebagai contoh. Ketika Load Balancer memerintahkan aplikasi untuk shutdown Load Balancer akan mengirimkan signal [Termination](https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html), di Go kita bisa mendapatkan signal tersebut di [syscall.SIGTERM](https://pkg.go.dev/syscall#SIGTERM). 

Agar aplikasi bisa mengenali signal tersebut, kita harus tambahkan kedaftar signal yang akan diamati oleh _signal.Notify_.

```go{18}
// main.go
func main() {
	// Mengkonversi HandleFunc menjadi Handler
	handler := http.HandlerFunc(hello)

	server := http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	// shutdownSignal harus merupakan buffered channel.
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverError:
		if err != nil {
			log.Fatal(err)
		}

	case sig := <-shutdownSignal:
		log.Println("Shutdown by signal: ", sig)

		timeout := 10 * time.Second
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			server.Close()
		}
	}
}
```

Sekarang aplikasi kita sudah menerapkan graceful shutdown dan membuat sedikit perbaikan dengan membatasi maksimal waktu untuk shutdown. Sebagai catatan, konsep ini tidak hanya berlaku pada router standard library saja, tapi juga bisa diterapkan pada router atau web framework pihak ketiga.