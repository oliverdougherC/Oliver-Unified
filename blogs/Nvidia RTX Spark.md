---
date: June 2 2026
---
Yesterday, Nvidia unveiled the "RTX Spark" to the world. Well, kind of. They *announced* it, and showed off some specs. This was following cryptic social media posts from Nvidia, Microsoft, and ARM about "A new era of PC". This is pretty funny to say since Apple had the same idea 6 years ago. That being said, Apple Silicon is a technological miracle, and a non-Apple alternative is always welcome. Naming is still a little up in the air, but it looks like they will offer 2 chips, the N1X and N1, with the N1 being a less powerful, cheaper version of the N1X.

If the name "RTX Spark" sounds strangely familiar, then you probably remember when Nvidia released the DGX Spark, a mini-pc with the GB10 chip. The GB10 and N1X are essentially identical, with the N1X basically acting as a consumer rebrand (and possibly slight revision) of the GB10. Before I give my opinion, here are the specs of the chip(s):

## Specs
### CPU (Grace)

| Variant | Cores        | Configuration                                            |
| ------- | ------------ | -------------------------------------------------------- |
| N1X     | **20 cores** | 10× Cortex-X925 (performance) + 10× Cortex-A725 (medium) |
| N1      | **12 cores** | 8× Cortex-X925 + 4× Cortex-A725                          |

### GPU (Blackwell RTX)

| Variant | CUDA Cores | Performance Equivalent  |
| ------- | ---------- | ----------------------- |
| N1X     | 6,144      | RTX 5070 Mobile (5070M) |
| N1      | 2,560      | RTX 5050                |

### Memory (Unified)

| Feature              | Specification                                        |
| -------------------- | ---------------------------------------------------- |
| Type                 | LPDDR5X-9400                                         |
| Bus Width            | 256-bit                                              |
| Max Capacity         | Up to 128 GB (N1X); up to 64 GB (N1)                 |
| Raw Bandwidth        | **~301 GB/s**                                        |
| Aggregate GPU Access | Up to 600 GB/s over NVLink-C2C coherent interconnect |

One thing I want to clarify since I've seen quite a bit of confusion online: is the memory bandwidth 300GB/s or 600GB/s? This is a very important distinction to make, as this will likely be a deal breaker for all the local AI people out there. The true answer is **300GB/s**. The 600GB/s figure refers to the bridge between the CPU and GPU, ensuring that inter-chiplet communication never becomes the bottleneck. These are identical figures to what we saw in the GB10 chip (DGX Spark). Anyway, here is my opinion of the RTX spark.

## My Take

Now, its hard to have a definitive opinion since firm price details have not been announced yet, but we do have rumors. If the rumors are to be believed (~$2,500+ for the N1X), I think the RTX Spark presents itself as an interesting option in the current market. However, I don't think we will see any crazy, market-disrupting wake from the launch. On paper, its basically identical to the M5 series of processors from Apple, in both performance and price (if rumors are to be believed). Remember though, this is Nvidia we're talking about. They don't have much interest in helping out the little guy, and I **highly** doubt the pricing estimates are accurate. Not only does Nvidia have a bad history with pricing, but the global memory situation is also definitely coming into play here. Anyone who thinks they're getting an N1X with 128GB of memory for anything less than $3k is utterly foolish. Frankly, I'd be surprised if you could get them for under $4k.

Theres also another huge, ugly, sinister elephant in the room that I have yet to address: Microslop. Microsoft is genuinely one of the worst companies in tech right now, and Windows is one of, if not the worst operating system right now, **especially** for AI workflows. This is an ARM CPU though, so what about Windows on ARM? Guess what, buddy? Even worse :)

Regardless, a lot is still up in the air, mainly pricing, which will be the real determining factor. I think its a cool chip and possibly a big jump forward for windows laptops (especially for power efficiency and battery life), but ultimately the success of this processor will depend on how low Nvidia can price it, and how quickly Microslop can get their act together.