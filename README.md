# MESI-cache-protocol

Simulates how the MESI (modified, exlcusive, shared, invalid) protocol works for multi-core systems.
Demonstrates how cache cohercy works.


M - Modified: Data in cache is modified (more recent) then the data in the memory. Data is in my cache only (exclusive)
E - Exclusive: Data in cache matches data in memory. Data is in my cache only (exclusive)
S - Shared: Data in cache is up to date with main memory. Shared copy with others
I - Invalid: My cache data is useless out of date.

Data Stored:
```
        # This represents object memory address : object data in main memory (RAM, not cache)
        objects_in_memory = 
        {"0x100":"Data A", "0x104":"Data B", "0x108":"Data C"}

        # This represents the cache lines that each core has. This array is indexed by the index of the core and includes memory address : [Data, M/E/S/I]
        self.cores = [
            # core 0
            {"0x100": ["Data F", "M"], "0x104": ["Data G", "I"]},
            # core 1
            {"0x108": ["Data C", "E"]}
        ]

        # The current clock position of the computer
        self.clock = 0
```

A core reading a memory address
1. Check our cache. If memory address not in cache, or memory address is pointing toward 'invalid,' perform a bus read, steps below

a) iterate through all cores. 
if we see core with cache that has address we want:
 -- in state M: we get that cache to push their data onto main memory and move into shared
 -- in state E: we just move them into shared and take their data from main memory
 -- in state S: we just take data from main memory
 -- not found at all in any: we take data from main memory and take exclusive state
 

2. If the memory address is in our cache, with state M, E, S we grab the data and return it.
    - This is because M, E, S states indicate that the cache data is the most up to date


