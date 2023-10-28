+++
date = '2023-09-23T03:00:03+07:00'
draft = false
title = 'A Simple Proof of XOR Uniqueness'
author = ["Jose Sitanggang"]
tags = ['computer-science', 'math', 'proof', 'bit-manipulation']
math = true
description = "When computers are too slow to prove the correctness, mathematics rides to the rescue. That's why we need math -- even computers could use a little math magic!"
+++

I have a simple algorithm to conceal an auto-increment ID within a globally unique identifier such as UUIDv4, which involves XOR. The motivation behind this algorithm is to eliminate the predictability of the auto-increment ID when it's exposed in a URL[^4].

I can use UUID directly, but indexing UUIDs in MySQL has a significant performance impact[^2]. UUID is necessary for security, while the auto-increment ID is essential for performance. This algorithm combines the best of both worlds. The basic idea is to generate a new ID, called **ShadowID**, derived from both the UUID and the auto-increment. The requirement is that the ShadowID must be reversible to retrieve the auto-increment and the UUID if we know the algorithm and the secret number that used to generate the ShadowID.This reversibility is essential for utilizing the auto-increment ID for database queries and the UUID as a security token.

Since the ShadowID is used for identification, **it must be unique**.

As a software engineer, to determine whether applying XOR breaks the uniqueness of the ShadowID, I wrote a simple program. Everything worked well for integers with fewer than 16 bits. However, for 32-bit integers, I found myself waiting too long for the results, and for int64, I ran out of memory. It was quite disappointing. 

Fortunately, I studied mathematics during my undergraduate computer science studies, so I decided to revisit my math textbook and came up with ideas to use math proofs instead. To put it in perspective, a set with $2^{64}$ members would require an astronomical amount of memory![^1]

Before we dive into the proof, let's formalize the problem statement.

## Problem Statement

For any chosen positive integer $M$, prove that applying XOR (⊕) with any possible value of $N$ to $M$ produces a unique result for each $N$, where $M, N \in \mathbb{Z}^{+}$.

There are many ways to prove this statement. In this article, I will use the proof by contradiction.

## Proof

Let's assume that there are two integers, $N_x$ and $N_y$, such that $N_x ⊕ M = N_y ⊕ M$ where $N_x \neq N_y$.

We will prove that this assumption leads to a contradiction, which means that we would find $N_x = N_y$. In mathematical notation:

$$\forall N_x, N_y, M \in \mathbb{Z}, \text{ if } N_x \oplus M = N_y \oplus M, \text{ then } N_x = N_y$$

**Proof by contradiction**

$$
\begin{split}
N_x ⊕ M &= N_y ⊕ M \newline
\tag{applying ⊕ with $M$ on both sides} \newline \newline
(N_x ⊕ M) ⊕ M &= (N_y ⊕ M) ⊕ M \newline
\end{split}
$$

Based on the assumption, the left and right sides are equal, so applying XOR to both sides will also be the same[^3]. Also, XOR is associative[^3]. Therefore:

$$
\begin{split}
(N_x ⊕ M) ⊕ M &= N_y ⊕ (M ⊕ M)
\end{split}
$$

Applying XOR to an integer with itself equals $0$, so $(M ⊕ M) = 0$. Additionally, when any integer is XOR with $0$ it returns the integer itself[^3]. By using this identity, we can simplify the equation to:

$$
\begin{split}
(N_x ⊕ M) ⊕ M &= N_y ⊕ 0 \newline
(N_x ⊕ M) ⊕ M &= N_y
\end{split}
$$

Performing the same operation on the left-hand side, we obtain:

$$
\begin{split}
N_x ⊕ (M ⊕ M) &= N_y \newline
N_x ⊕ 0 &= N_y \newline
N_x &= N_y
\end{split}
$$

As a result, we have found that $N_x = N_y$ contradicting our initial assumption of distinct $N$ values. This demonstrates that, in order to produce the same result on both sides, $N_x$ must be equal to $N_y$ $\blacksquare$.


## Conclusion

We've proven that applying XOR to an integer with any possible value of $N$ produces a unique result for each $N$. This proof is essential to ensure that the ShadowID is unique. If you are interested in the algorithm, please refer to my article titled "**[ShadowID: Expose the Auto Increment ID to Public Without Compromising Security](/posts/golang/shadowid-expose-the-auto-increment-id-to-public-without-compromising-security/)**."

[^1]:[$2^{64}$ bytes is enough for any human](https://lwn.net/Articles/80696)
[^2]:[UUIDs are Popular, but Bad for Performance](https://www.percona.com/blog/uuids-are-popular-but-bad-for-performance-lets-discuss)
[^3]:[Interesting Properties of the Exclusive Or (XOR)](https://markusthill.github.io/electronics/a-few-properties-of-the-exclusive-or/)
[^4]:[Insecure Direct Object Reference Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html#mitigation)

