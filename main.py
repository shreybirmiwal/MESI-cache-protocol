objects_in_memory = {"0x100":"Data A", "0x104":"Data B", "0x108":"Data C"}

cores = [
    # core 1
    {"0x100": ["Data F", "M"], "0x104": ["Data G", "I"]},
    # core 2
    {"0x108": ["Data C", "E"]}
]

# Adds a new value at memory_address to the main memory storage
def addObjectToMemory(memory_address, value):
    objects_in_memory[memory_address] = value
    return

# Read value of memory_address (from core POV)
def read(core, memory_address):
    # Case 1: Memory not in cache at all
    # --> anyone shouting out that they have it?, then communicate with them
    # --> get it from main memory? shout that you're about to get it from main memory

    # Case 2: We are in M state
    # --> exclusive, so just return the value from cache
    # Clock advances +1

    # Case 3: We are in 
    

def write():