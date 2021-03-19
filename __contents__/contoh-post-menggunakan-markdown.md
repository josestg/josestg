---
title: Contoh Post Menggunakan Markdown
intro: Post ini adalah post uji coba yang digunakan selama development, oleh karena itu isi dari konten ini akan berfokus pada hal-hal yang berkaitan dengan debugging.
dateCreated: 1 Aug 2020
useLatex: true
categories:
  - Nextjs
  - Markdown
  - SSR
---

Post ini adalah post uji coba yang digunakan selama _development_, oleh karena itu isi dari konten ini akan berfokus pada
hal-hal yang berkaitan dengan _debugging_.

# Menampilkan Teks

Ini adalah contoh paragraf yang berada di bawah header level 1. Paragraf ini memiliki kata bertulis **tebal**, _miring_, ~~tercoret~~, [link eksternal](www.google.com), `code`, dan inline-math: $y = f(\sum_{i=1}^{D} w_i*x_i)$.

Selain beberapa pengayaan diatas, kadang dibutuhkan sebuah daftar (_list_). Dengan markdown kita dapat membuat _ordered list_ dan _underored list_. Berikut ini adalah contoh _ordered list_ dan _underored list_.

## Unordered List

Berikut adalah beberapa _tech stack_ yang digunakan untuk mengembangkan web ini.

- **Nextjs**. React framework untuk membuat server side rendering.
- **TypeScript**. JavaScript + Dukungan tipe data.
- **Chakra UI**. React Styling library dengan dukungan [styled-system](https://styled-system.com/).
- **Markdown**. Bahasa markup untuk menulis konten.
- **Katex**. Menampilkan persamaan matematika.

## Ordered List

Berikut adalah beberapa _tech stack_ yang digunakan untuk mengembangkan web ini.

1. **Nextjs**. React framework untuk membuat server side rendering.
2. **TypeScript**. JavaScript + Dukungan tipe data.
3. **Chakra UI**. React Styling library dengan dukungan [styled-system](https://styled-system.com/).
4. **Markdown**. Bahasa markup untuk menulis konten.
5. **Katex**. Menampilkan persamaan matematika.

Untuk menampilkan kutipan dapat menggunakan tanda `>`. Sebagai contoh:

> Ini adalah contoh kutipan. Kutipan juga dapat berisi tulisan **tebal**, _miring_, ~~tercoret~~, [link eksternal](www.google.com), `code`, dan inline-math: $y = f(\sum_{i=1}^{D} w_i*x_i)$.

# Presentasi Data dan _Source Code_

Kita dapat menampilkan gambar, video, tabel, source code, dan _block-math_ pada konten ini. Caranya adalah sebagai berikut.

## Gambar

Contoh kalimat yang berada di atas sebuah gambar. Gambar yang ditampilkan dapat berasal dari external link dan internal link. Berikut ini adalah contoh gambar yang berasal dari internal link.

![Gambar dari public/images](/images/bot-arc.png)

Contoh kalimat yang berada dibawah gambar sekaligus diatas sebuah gambar lain yang berasal dari external link.

![Gambar dari external link](https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=755&q=80)

## Tabel

Berikut ini adalah contoh penyajian data dalam bentuk tabel.



| Kolom A - Rata Kiri | Kolom B - Rata Tengah | Kolom C - Rata Kanan |
| :------------------ | :-------------------: | -------------------: |
| Baris ke-1 kolom A  |  Baris ke-1 kolom C   |   Baris ke-1 Kolom B |
| Baris ke-2 kolom A  |  Baris ke-2 kolom C   |   Baris ke-2 Kolom B |
| Baris ke-3 kolom A  |  Baris ke-3 kolom C   |   Baris ke-3 Kolom B |



> Tabel juga berbagai format teks seperti cetak tebal, miring, dll.

## Source Code

Berikut ini adalah contoh menampilkan _source code_ dalam konten.

```tsx{7,11,12}:pages/_app.tsx
import NextApp from "next/app"
import { ThemeProvider, ColorModeProvider, CSSReset } from "@chakra-ui/core"

import theme from "../themes/chakra-ui"

export default class App extends NextApp {
  render() {
    const { Component, pageProps } = this.props
    return (
      <ThemeProvider theme={theme}>
        <ColorModeProvider value="light">
          <CSSReset />
          <Component {...pageProps} />
        </ColorModeProvider>
      </ThemeProvider>
    )
  }
}
```

Code hilighting menggunakan library prism sebagai dasar.

## Latex

Berikut adalah cara menampilkan _block latex_, yaitu dengan menggunakan simbol `$$...$$` kemudian diikuti dengan sintax latex.

$$
y = f(\sum_{i=1}^{D} w_i*x_i) \\
y = f(w_1*x_1 + w_2*x_2 + ... w_D*x_D)
$$

contoh kalimat dibawah latex.