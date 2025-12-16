# MESI-cache-protocol

Simulates how the MESI (modified, exlcusive, shared, invalid) protocol works for multi-core systems.
Demonstrates how cache cohercy works.

---


## MESI States

* **M – Modified**
Data in cache is modified (more recent) then the data in the memory. Data is in my cache only (exclusive)

* **E – Exclusive**
 Data in cache matches data in memory. Data is in my cache only (exclusive)

 * **S – Shared**
 Data in cache is up to date with main memory. Shared copy with others

 * **I – Invalid**
 My cache data is useless out of date.
---

## Data Stored

```python
# This represents object memory address : object data in main memory (RAM, not cache)
objects_in_memory = {
    "0x100": "Data A",
    "0x104": "Data B",
    "0x108": "Data C"
}

# This represents the cache lines that each core has.
# This array is indexed by the index of the core and includes:
# memory address : [Data, M/E/S/I]
self.cores = [
    # core 0
    {"0x100": ["Data F", "M"], "0x104": ["Data G", "I"]},
    # core 1
    {"0x108": ["Data C", "E"]}
]

# The current clock position of the computer
self.clock = 0
```

---

## Reading Data

### 1. Cache Check
A core reading a memory address
1. Check our core's cache. If memory address not in cache, or memory address is pointing toward 'invalid,' perform a bus snoop (step 2). If memory address is in cache of our core, go to step 3 (cache hit)

### 2. Bus read (snoop)

We check all other cores to check if any cache has the memory address we need

Iterate through all cores. If we see core with cache that has address we want:
**State M (Modified)**
- we move that core into shared state
- we PEER TO PEER (Core 2 Core) share the data to ourselve
- ourselves goes into shared state

**State E (Exclusive)**
- we just push the other core  into shared 
- we peer to peer take their data 
- we ourselves go into shared state

**State S (Shared)**
- data is already in shared state, so we just peer ot peer share it with ourselves
- we get the data also in shared state

**State I (Invalid)**

  * Ignored, because this is useless


**Not found at all in any:**
 - we take data from main memory
 - we take exclusive state
 

###  3. Cache hit

If the memory address is in our cache, with state M, E, S we grab the data and return it. This is because M, E, S states indicate that the cache data is the most up to date


