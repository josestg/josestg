+++
date = '2023-10-27T00:46:55+07:00'
draft = false
title = 'How Can Adding a New Item to a Dynamic Array Be Achieved in Constant Time?'
author = ["Jose Sitanggang"]
tags = []
description = "In short: It's a geometric series, and we'll use amortized analysis to explain it."
math = true
+++

Based on the previous article titled "**[Implement Dynamic Array in C++](https://josestg.com/blog/implement-dynamic-array-in-cpp)**," we know that a dynamic array is a data structure that can grow and shrink as needed, which is called **resizing**.

As seen in the implementation, resizing is an expensive operation because it involves copying all the items from the old array to the new array. This resizing is performed only when the array is full. Since the capacity is doubled each time the array is resized, the resizing operation will be less frequent as the array grows. This makes amortized analysis the best approach to understand the complexity because it distributes the cost of resizing over all the operations.

In simple terms, amortized analysis is a way to calculate the average cost of an operation over a sequence of operations [^1].

To make it easier, let's formalize the problem statement.

## Problem Statement

Let $A$ be a dynamic array with $L$ is the length and $C$ is the capacity. 
Adding a new item to the array increases $L$ by 1. When $L=C$, the array is resized by doubling its capacity. This means the next resizing is performed when $L=2C$, then $L=4C$, $L=8C$, and so on. Show that by adding $N$ items to the array, the amortized cost of adding a new item is $O(1)$.

## Solution

Let's define $\sigma$ is the sum of the number of items copied during resizing. We can calculate $\sigma$ as follows:

$$
\begin{split}
\sigma  &= C + 2C + 4C +  \dots + 2^{k-1}C + 2^kC  \newline
        &= (1 + 2 + 4 + \dots + 2^{k-1} + 2^k) C \newline
\end{split}
$$

Where $k$ is the number of resizing performed to fit $N$ items in $A$. We can calculate $k$ as follows:

$$
\begin{split}
N           &= 2^kC \newline
\log_2 N    &= \log_2 \({2^kC}\) \newline
\log_2 N    &= \log_2{2^k} + \log_2{C} \newline
\log_2 N    &= k + \log_2 C \newline
k           &= \log_2 N - \log_2 C \newline
k           &= \log_2 \frac{N}{C}
\end{split}
$$

Now, we have $k$ in terms of $N$ and $C$. We can substitute $k$ in $\sigma$, but let's simplify $\sigma$ first. We can rewrite $\sigma$ from the highest order to the lowest order as follows:

$$
\begin{split}
\sigma &= (1 + 2 + 4 + \dots + 2^{k-1} + 2^k) C \newline
       &= (2^k + 2^{k-1} + \dots + 4 + 2 + 1) C \newline
\end{split}
$$

Let's focus on the $2^k$ term for a moment. As we can see, $2^k$ forms a geometric series with $a=2^k$ and $r=\frac{1}{2}$. Since $r<1$, we can use the geometric partial sum formula ($S_n$)[^2] to calculate the total number of copies:

$$
\begin{split}
 S_n &= 2^k + 2^{k-1} + \dots + 4 + 2 + 1 \newline
     &= \frac{a}{1-r} \newline
     &= \frac{2^k}{1-\frac{1}{2}} \newline
     &= 2^{k+1} \newline
     &= 2 \times 2^k
\end{split}
$$

Now, we can substitute the expression for $k$ in terms of $N$ and $C$:

$$
\begin{split}
S_n &= 2 \times 2^k \newline
    &= 2 \times \bcancel{2}^{\cancel{\log_2} \frac{N}{C}} \newline
    &= 2 \times \frac{N}{C} \newline
    &= \frac{2N}{C}
\end{split}
$$

Finally, we can substitute the value of $S_n$ into the expression for $\sigma$:

$$
\begin{split}
\sigma &= (2^k + 2^{k-1} + \dots + 4 + 2 + 1) C \newline
       &= S_n C \newline
       &= \frac{2N}{\bcancel{C}} \bcancel{C} \newline
       &= 2N
\end{split}
$$

The $\sigma$ is the total number of items copied during resizing. We also know that the total number of items added to the array is $N$. Therefore, the total number of operations is $N + \sigma$. Since we want to calculate the amortized cost of adding a new item, we can divide the total number of operations by $N$:


$\sigma$ only represents the total number of items copied during resizing, and we know that the total number of items added to the array is $N$. Therefore, the total number of operations is $N + \sigma$.

To calculate the amortized cost of adding a new item, we divide the total number of operations by $N$ to get the average cost:

$$
\begin{split}
amortized   &= O(\frac{\sigma + N}{N}) \newline
            &= O(\frac{2\bcancel{N}+\bcancel{N}}{\bcancel{N}}) \newline
            &= O(3) \newline
            &= O(1)
\end{split}
$$

Thus, we've shown that the amortized cost of adding a new item to a dynamic array is $O(1)$.

## Conclusion

In this article, we've demonstrated that adding a new item to a dynamic array has an amortized complexity $O(1)$. We've also seen that for non-uniform workloads, where some operations are more expensive than others, amortized analysis is the most effective approach to comprehend complexity, as it evenly spreads the resizing cost across all operations.


[^1]: [Amortized Analysis](https://www.cs.cornell.edu/courses/cs3110/2011fa/supplemental/lec20-amortized/amortized.html)
[^2]: [Geometric Series ](https://mathbooks.unl.edu/Calculus/sec-7-2-geometric.html)