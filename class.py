class cpu_simulator:

    def __init__(self):
        self.objects_in_memory = {"0x100":"Data A", "0x104":"Data B", "0x108":"Data C"}
        self.cores = [
            # core 0
            {"0x100": ["Data F", "M"], "0x104": ["Data G", "I"]},
            # core 1
            {"0x108": ["Data C", "E"]}
        ]
        self.clock = 0


    def addObjectToMemory(self, memory_address, value):
        self.objects_in_memory[memory_address] = value
        self.clock += 100
        return

    def readFromMemory(self, memory_address):
        self.clock += 100
        if memory_address in self.objects_in_memory:
            return self.objects_in_memory[memory_address]
        else:
            raise KeyError(f"Memory address {memory_address} not found") 

    # Read value of memory_address (from core POV)
    def read(self, core_index, memory_address):
        print("Core: ", core_index, " attempting to get from memory address: ", memory_address)
        current_core_cache = self.cores[core_index]

        # Case 1: Memory not in cache at all OR is invalid
        # --> anyone shouting out that they have it?, then communicate with them
        # --> get it from main memory? shout that you're about to get it from main memory
        # essnetially called a cache
        if memory_address not in current_core_cache or current_core_cache[memory_address][1] == "I":
            print("Memory address: ", memory_address, " not found in cache or is invalid, sending bus to snoop")
            action = self.bus_read(core_index, memory_address)

            if action == 1:
                correct_value = self.readFromMemory(memory_address)
                # add to our cache in shared state
                self.cores[core_index][memory_address] =  [correct_value, "S"]

            if action == 2:
                correct_value = self.readFromMemory(memory_address)
                self.cores[core_index][memory_address] =  [correct_value, "E"]
        
        current_value = current_core_cache[memory_address][0]
        current_state = current_core_cache[memory_address][1]

        # Case 2/3/4: We are in M (exclusive but dirty) state or E (exclusive and clean) state or S state (Shared but clean)
        # just return the value from cache, all of these cases still imply cache line is correct answer
        # Clock advances +1
        if current_state == "M" or current_state == "E" or current_state == "S":

            print("Memory address is in our cache.")

            print("----Pre----")
            print("State:", current_state, " Value:", current_value, " Clock:", self.clock)

            self.clock += 1

            print("----Post----")
            print("State:", current_state, " Value:", current_value, " Clock:", self.clock)

        return current_value


    # returns 1: its good to read from main memory
    # returns 2: read from main memory, your the only one with it
    def bus_read(self, from_core_index, memory_address):
        print("Running a bus read from ", from_core_index, " to look for ", memory_address)
        # we need to bus through everything, see if anyone has the value
        for i in range (0, len(self.cores)):

            self.clock += 1
            if i == from_core_index:
                # ignore our own core
                continue

            core = self.cores[i]
            if memory_address in core:
                
                state = core[memory_address][1]
                value = core[memory_address][0]

                if state == 'I':
                    # ignore invalid
                    continue

                elif state == 'M':
                    # this core has modified, we want them to write to main memory so that we can read from it
                    self.addObjectToMemory(memory_address, value)
                    core[memory_address][1] = "S" #downgrade to shared
                    return 1 # its good to read from main memory
                
                elif state == 'E':
                    # downgrade to shared
                    core[memory_address][1] = 'S'
                    return 1

                elif state == 'S':
                    return 1 # its good to read from main memory

        # we couldn't find anyone in this snoop, just get from main memory, you're in exclusive state 
        return 2


    # def write(self, core_index, memory_address):
        # S
        # --> Move into E first, kick out everyone by telling everyone you're changing it, they should move into I

        #E
        # --> already exlcusive, just update, then silently move into Modified

        #M
        # --> already mofied, jsut modify it further

        # I
        # Not in cache at all
        # ? 

x = cpu_simulator()
print(x.read(1, "0x108"))
print(x.read(1, "0x100"))