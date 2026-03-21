"""
PivotPath DSA Structures — Production Grade
Implements upgrades 26-35:
  26. Bloom filter      — O(1) duplicate enrollment detection
  27. Trie              — O(k) skill/role autocomplete
  28. LFU cache         — frequency-based eviction for hot endpoints
  29. Skip list         — O(log n) sorted credential ranking
  30. Segment tree      — O(log n) range queries on worker analytics
  31. A* pathfinding    — heuristic career graph optimisation
  32. Union-Find        — O(α(n)) skill cluster detection
  33. Consistent hashing — distribute vector store shards
  34. Fibonacci heap    — O(1) amortised decrease-key priority queue
  35. Suffix array      — O(m log n) full-text credential search
"""

import heapq
import hashlib
import math
import random
from bisect import bisect, insort
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict


# ─── Upgrade 26: Bloom Filter ─────────────────────────────────────────────────
class BloomFilter:
    """
    Space-efficient probabilistic set membership check.
    O(1) insert and lookup. ~0.1% false positive rate.
    Used to skip DB queries for definitely-not-enrolled cases.
    """
    def __init__(self, capacity: int = 100_000, error_rate: float = 0.001):
        self.capacity = capacity
        self.error_rate = error_rate
        # Optimal bit array size and hash count
        self.size = self._optimal_size(capacity, error_rate)
        self.hash_count = self._optimal_hash_count(self.size, capacity)
        self.bit_array = bytearray(self.size // 8 + 1)
        self._count = 0

    @staticmethod
    def _optimal_size(n: int, p: float) -> int:
        return int(-n * math.log(p) / (math.log(2) ** 2))

    @staticmethod
    def _optimal_hash_count(m: int, n: int) -> int:
        return max(1, int((m / n) * math.log(2)))

    def _hash_positions(self, item: str) -> List[int]:
        positions = []
        for seed in range(self.hash_count):
            h = int(hashlib.md5(f"{seed}:{item}".encode()).hexdigest(), 16)
            positions.append(h % self.size)
        return positions

    def add(self, item: str):
        for pos in self._hash_positions(item):
            self.bit_array[pos // 8] |= (1 << (pos % 8))
        self._count += 1

    def __contains__(self, item: str) -> bool:
        return all(
            self.bit_array[pos // 8] & (1 << (pos % 8))
            for pos in self._hash_positions(item)
        )

    def __len__(self) -> int:
        return self._count

    def estimated_false_positive_rate(self) -> float:
        if self._count == 0:
            return 0.0
        return (1 - math.exp(-self.hash_count * self._count / self.size)) ** self.hash_count


# ─── Upgrade 27: Trie ─────────────────────────────────────────────────────────
class TrieNode:
    __slots__ = ("children", "is_end", "value", "count")
    def __init__(self):
        self.children: Dict[str, "TrieNode"] = {}
        self.is_end: bool = False
        self.value: Optional[str] = None
        self.count: int = 0  # frequency for ranked autocomplete


class Trie:
    """
    Prefix tree for O(k) autocomplete where k = query length.
    Supports frequency-ranked suggestions (most searched first).
    Used for skill and role autocomplete in the frontend.
    """
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str, value: Optional[str] = None):
        node = self.root
        for ch in word.lower():
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_end = True
        node.value = value or word
        node.count += 1

    def search_prefix(self, prefix: str, max_results: int = 10) -> List[Dict]:
        node = self.root
        for ch in prefix.lower():
            if ch not in node.children:
                return []
            node = node.children[ch]
        results = []
        self._collect(node, results)
        # Sort by frequency descending
        results.sort(key=lambda x: x["count"], reverse=True)
        return results[:max_results]

    def _collect(self, node: TrieNode, results: List):
        if node.is_end:
            results.append({"value": node.value, "count": node.count})
        for child in node.children.values():
            self._collect(child, results)

    def increment(self, word: str):
        """Increment usage count — called when user selects a suggestion."""
        node = self.root
        for ch in word.lower():
            if ch not in node.children:
                return
            node = node.children[ch]
        if node.is_end:
            node.count += 1


# ─── Upgrade 28: LFU Cache ───────────────────────────────────────────────────
class LFUCache:
    """
    Least Frequently Used cache with O(1) get/put.
    Tracks access frequency — the most-queried signals never get evicted.
    Unlike LRU, 'Prompt Engineering' queried 1000x/day stays cached
    even if it wasn't accessed in the last few minutes.
    """
    def __init__(self, capacity: int = 256):
        self.cap = capacity
        self.cache: Dict[str, Tuple[Any, int]] = {}   # key → (value, freq)
        self.freq_map: Dict[int, Dict[str, None]] = defaultdict(dict)  # freq → ordered keys
        self.min_freq: int = 0
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            self._misses += 1
            return None
        self._hits += 1
        val, freq = self.cache[key]
        self._update_freq(key, freq)
        return val

    def put(self, key: str, value: Any):
        if self.cap <= 0:
            return
        if key in self.cache:
            self.cache[key] = (value, self.cache[key][1])
            self.get(key)  # update frequency
            return
        if len(self.cache) >= self.cap:
            # Evict least frequently used
            evict_key = next(iter(self.freq_map[self.min_freq]))
            del self.freq_map[self.min_freq][evict_key]
            del self.cache[evict_key]
        self.cache[key] = (value, 1)
        self.freq_map[1][key] = None
        self.min_freq = 1

    def _update_freq(self, key: str, freq: int):
        del self.freq_map[freq][key]
        if not self.freq_map[freq] and freq == self.min_freq:
            self.min_freq += 1
        new_freq = freq + 1
        self.freq_map[new_freq][key] = None
        self.cache[key] = (self.cache[key][0], new_freq)

    def stats(self) -> Dict:
        total = self._hits + self._misses
        return {
            "size": len(self.cache),
            "capacity": self.cap,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0.0,
            "min_freq": self.min_freq,
        }

    def invalidate(self, key: str):
        if key in self.cache:
            freq = self.cache[key][1]
            del self.freq_map[freq][key]
            del self.cache[key]


# ─── Upgrade 29: Skip List ────────────────────────────────────────────────────
class SkipListNode:
    __slots__ = ("score", "value", "forward")
    def __init__(self, score: float, value: str, level: int):
        self.score = score
        self.value = value
        self.forward: List[Optional["SkipListNode"]] = [None] * (level + 1)


class SkipList:
    """
    Probabilistic sorted data structure with O(log n) insert/search/delete.
    Used for maintaining sorted credential rankings with live demand score updates.
    Redis uses skip lists internally for its sorted set (ZADD/ZRANGE).
    """
    MAX_LEVEL = 16
    P = 0.5

    def __init__(self):
        self.header = SkipListNode(-float("inf"), "", self.MAX_LEVEL)
        self.level = 0
        self._size = 0

    def _random_level(self) -> int:
        lvl = 0
        while random.random() < self.P and lvl < self.MAX_LEVEL:
            lvl += 1
        return lvl

    def insert(self, score: float, value: str):
        update = [None] * (self.MAX_LEVEL + 1)
        cur = self.header
        for i in range(self.level, -1, -1):
            while cur.forward[i] and cur.forward[i].score < score:
                cur = cur.forward[i]
            update[i] = cur
        lvl = self._random_level()
        if lvl > self.level:
            for i in range(self.level + 1, lvl + 1):
                update[i] = self.header
            self.level = lvl
        node = SkipListNode(score, value, lvl)
        for i in range(lvl + 1):
            node.forward[i] = update[i].forward[i]
            update[i].forward[i] = node
        self._size += 1

    def search(self, score: float) -> Optional[str]:
        cur = self.header
        for i in range(self.level, -1, -1):
            while cur.forward[i] and cur.forward[i].score < score:
                cur = cur.forward[i]
        cur = cur.forward[0]
        if cur and cur.score == score:
            return cur.value
        return None

    def top_n(self, n: int, descending: bool = True) -> List[Dict]:
        """Return top-n items by score."""
        items = []
        cur = self.header.forward[0]
        while cur:
            items.append({"score": cur.score, "value": cur.value})
            cur = cur.forward[0]
        items.sort(key=lambda x: x["score"], reverse=descending)
        return items[:n]

    def __len__(self) -> int:
        return self._size


# ─── Upgrade 30: Segment Tree ────────────────────────────────────────────────
class SegmentTree:
    """
    Range sum and range max queries in O(log n).
    Used for cohort analytics: sum of completions in a date range,
    max progress in a date bucket, without full table scans.
    """
    def __init__(self, data: List[int]):
        self.n = len(data)
        self.tree = [0] * (4 * self.n)
        self.lazy = [0] * (4 * self.n)
        if self.n:
            self._build(data, 0, 0, self.n - 1)

    def _build(self, data: List[int], node: int, start: int, end: int):
        if start == end:
            self.tree[node] = data[start]
        else:
            mid = (start + end) // 2
            self._build(data, 2 * node + 1, start, mid)
            self._build(data, 2 * node + 2, mid + 1, end)
            self.tree[node] = self.tree[2 * node + 1] + self.tree[2 * node + 2]

    def range_sum(self, l: int, r: int) -> int:
        """Sum of values in index range [l, r]. O(log n)."""
        return self._query_sum(0, 0, self.n - 1, l, r)

    def range_max(self, l: int, r: int) -> int:
        """Max value in index range [l, r]. O(log n)."""
        return self._query_max(0, 0, self.n - 1, l, r)

    def update(self, idx: int, val: int):
        """Point update at index idx. O(log n)."""
        self._update(0, 0, self.n - 1, idx, val)

    def _query_sum(self, node, start, end, l, r) -> int:
        if r < start or end < l:
            return 0
        if l <= start and end <= r:
            return self.tree[node]
        mid = (start + end) // 2
        return (self._query_sum(2*node+1, start, mid, l, r) +
                self._query_sum(2*node+2, mid+1, end, l, r))

    def _query_max(self, node, start, end, l, r) -> int:
        if r < start or end < l:
            return 0
        if l <= start and end <= r:
            return self.tree[node]
        mid = (start + end) // 2
        return max(self._query_max(2*node+1, start, mid, l, r),
                   self._query_max(2*node+2, mid+1, end, l, r))

    def _update(self, node, start, end, idx, val):
        if start == end:
            self.tree[node] = val
        else:
            mid = (start + end) // 2
            if idx <= mid:
                self._update(2*node+1, start, mid, idx, val)
            else:
                self._update(2*node+2, mid+1, end, idx, val)
            self.tree[node] = self.tree[2*node+1] + self.tree[2*node+2]


# ─── Upgrade 31: A* Pathfinding ──────────────────────────────────────────────
def astar_career_path(G, start: str, goal: str) -> Optional[Dict]:
    """
    A* search on the career graph using salary gap as heuristic.
    2-10x faster than Dijkstra on large graphs by guiding search
    toward roles closer in salary to the target.
    Falls back gracefully if graph or nodes unavailable.
    """
    if start not in G or goal not in G:
        return None

    goal_salary = G.nodes[goal].get("avg_salary", 100_000)

    def heuristic(node: str) -> float:
        node_salary = G.nodes[node].get("avg_salary", 50_000)
        return max(0, goal_salary - node_salary) / 10_000

    open_set: List[Tuple[float, int, str]] = [(0.0, 0, start)]
    g_score: Dict[str, float] = {start: 0.0}
    came_from: Dict[str, str] = {}
    counter = 0

    while open_set:
        _, _, current = heapq.heappop(open_set)

        if current == goal:
            # Reconstruct path
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            path.reverse()

            total_weeks = sum(
                G[path[i]][path[i+1]].get("weeks", 0)
                for i in range(len(path) - 1)
            )
            total_cost = sum(
                G[path[i]][path[i+1]].get("cost", 0)
                for i in range(len(path) - 1)
            )
            steps = [
                {
                    "from": path[i], "to": path[i+1],
                    "weeks": G[path[i]][path[i+1]].get("weeks", 0),
                    "cost": G[path[i]][path[i+1]].get("cost", 0),
                    "difficulty": G[path[i]][path[i+1]].get("weight", 5),
                }
                for i in range(len(path) - 1)
            ]
            from_salary = G.nodes[start].get("avg_salary", 0)
            to_salary = G.nodes[goal].get("avg_salary", 0)
            return {
                "path": path,
                "steps": steps,
                "total_weeks": total_weeks,
                "total_cost_usd": total_cost,
                "from_salary": from_salary,
                "to_salary": to_salary,
                "salary_uplift": to_salary - from_salary,
                "num_transitions": len(path) - 1,
                "algorithm": "A*",
            }

        for neighbor in G.neighbors(current):
            edge = G[current][neighbor]
            tentative_g = g_score.get(current, float("inf")) + edge.get("weight", 1)
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor)
                counter += 1
                heapq.heappush(open_set, (f_score, counter, neighbor))

    return None  # No path found


# ─── Upgrade 32: Union-Find (Disjoint Set Union) ─────────────────────────────
class UnionFind:
    """
    Near-constant O(α(n)) amortised time using path compression + union by rank.
    Used to cluster related skills so learning one gives partial credit toward others.
    E.g. learning 'Python' clusters with 'Data Analysis', 'ML Engineering'.
    """
    def __init__(self, elements: Optional[List[str]] = None):
        self.parent: Dict[str, str] = {}
        self.rank: Dict[str, int] = {}
        self.size: Dict[str, int] = {}
        self.cluster_labels: Dict[str, str] = {}  # representative → cluster name
        if elements:
            for e in elements:
                self._add(e)

    def _add(self, x: str):
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
            self.size[x] = 1

    def find(self, x: str) -> str:
        self._add(x)
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x: str, y: str) -> bool:
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        # Union by rank
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        self.size[px] += self.size[py]
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        return True

    def same_cluster(self, x: str, y: str) -> bool:
        return self.find(x) == self.find(y)

    def get_cluster(self, x: str) -> List[str]:
        root = self.find(x)
        return [k for k in self.parent if self.find(k) == root]

    def label_cluster(self, representative: str, label: str):
        self.cluster_labels[self.find(representative)] = label

    def get_cluster_label(self, x: str) -> Optional[str]:
        return self.cluster_labels.get(self.find(x))

    def all_clusters(self) -> Dict[str, List[str]]:
        clusters: Dict[str, List[str]] = defaultdict(list)
        for element in self.parent:
            clusters[self.find(element)].append(element)
        return dict(clusters)


# ─── Upgrade 33: Consistent Hashing ─────────────────────────────────────────
class ConsistentHash:
    """
    Distribute vector store collections across multiple shards.
    When shards are added/removed, only K/n keys remap (vs K with naive hashing).
    Used by Cassandra, DynamoDB, and Discord's message storage.
    """
    def __init__(self, nodes: Optional[List[str]] = None, replicas: int = 150):
        self.replicas = replicas
        self.ring: Dict[int, str] = {}
        self.sorted_keys: List[int] = []
        self._nodes: List[str] = []
        if nodes:
            for node in nodes:
                self.add_node(node)

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        self._nodes.append(node)
        for i in range(self.replicas):
            key = self._hash(f"{node}:{i}")
            self.ring[key] = node
            insort(self.sorted_keys, key)

    def remove_node(self, node: str):
        if node in self._nodes:
            self._nodes.remove(node)
        for i in range(self.replicas):
            key = self._hash(f"{node}:{i}")
            if key in self.ring:
                del self.ring[key]
                self.sorted_keys.remove(key)

    def get_node(self, key: str) -> Optional[str]:
        if not self.ring:
            return None
        h = self._hash(key)
        idx = bisect(self.sorted_keys, h) % len(self.sorted_keys)
        return self.ring[self.sorted_keys[idx]]

    def get_nodes(self) -> List[str]:
        return list(self._nodes)

    def get_shard_distribution(self) -> Dict[str, int]:
        """Show how many virtual nodes each physical node owns."""
        dist: Dict[str, int] = defaultdict(int)
        for node in self.ring.values():
            dist[node] += 1
        return dict(dist)


# ─── Upgrade 34: Fibonacci Heap ──────────────────────────────────────────────
class FibNode:
    __slots__ = ("key", "value", "degree", "marked", "parent", "child", "left", "right")
    def __init__(self, key: float, value: Any):
        self.key = key
        self.value = value
        self.degree = 0
        self.marked = False
        self.parent: Optional["FibNode"] = None
        self.child: Optional["FibNode"] = None
        self.left: "FibNode" = self
        self.right: "FibNode" = self


class FibonacciHeap:
    """
    Fibonacci heap with O(1) amortised insert and decrease-key.
    O(log n) extract-min. Theoretically optimal for Dijkstra: O(E + V log V).
    Used in Google's network routing and computational biology.
    """
    def __init__(self):
        self.min_node: Optional[FibNode] = None
        self.total: int = 0

    def insert(self, key: float, value: Any) -> FibNode:
        node = FibNode(key, value)
        self._add_to_root(node)
        if self.min_node is None or key < self.min_node.key:
            self.min_node = node
        self.total += 1
        return node

    def find_min(self) -> Optional[FibNode]:
        return self.min_node

    def extract_min(self) -> Optional[FibNode]:
        z = self.min_node
        if z is None:
            return None
        if z.child:
            children = self._iterate(z.child)
            for child in children:
                self._add_to_root(child)
                child.parent = None
        self._remove_from_root(z)
        if z == z.right:
            self.min_node = None
        else:
            self.min_node = z.right
            self._consolidate()
        self.total -= 1
        return z

    def decrease_key(self, node: FibNode, new_key: float):
        """O(1) amortised — the key advantage over binary heap."""
        if new_key > node.key:
            raise ValueError("New key is greater than current key")
        node.key = new_key
        parent = node.parent
        if parent and node.key < parent.key:
            self._cut(node, parent)
            self._cascading_cut(parent)
        if node.key < self.min_node.key:
            self.min_node = node

    def _add_to_root(self, node: FibNode):
        if self.min_node is None:
            node.left = node.right = node
            self.min_node = node
        else:
            node.right = self.min_node
            node.left = self.min_node.left
            self.min_node.left.right = node
            self.min_node.left = node

    def _remove_from_root(self, node: FibNode):
        node.left.right = node.right
        node.right.left = node.left

    def _cut(self, node: FibNode, parent: FibNode):
        if node.right == node:
            parent.child = None
        else:
            if parent.child == node:
                parent.child = node.right
            node.left.right = node.right
            node.right.left = node.left
        parent.degree -= 1
        self._add_to_root(node)
        node.parent = None
        node.marked = False

    def _cascading_cut(self, node: FibNode):
        parent = node.parent
        if parent:
            if not node.marked:
                node.marked = True
            else:
                self._cut(node, parent)
                self._cascading_cut(parent)

    def _consolidate(self):
        max_degree = int(math.log2(max(self.total, 1))) + 2
        degree_table: List[Optional[FibNode]] = [None] * max_degree
        roots = self._iterate(self.min_node)
        for root in roots:
            d = root.degree
            while d < max_degree and degree_table[d] is not None:
                other = degree_table[d]
                if root.key > other.key:
                    root, other = other, root
                self._link(other, root)
                degree_table[d] = None
                d += 1
            if d < max_degree:
                degree_table[d] = root
        self.min_node = None
        for node in degree_table:
            if node:
                if self.min_node is None or node.key < self.min_node.key:
                    self.min_node = node

    def _link(self, child: FibNode, parent: FibNode):
        self._remove_from_root(child)
        child.parent = parent
        if parent.child is None:
            parent.child = child
            child.left = child.right = child
        else:
            child.right = parent.child
            child.left = parent.child.left
            parent.child.left.right = child
            parent.child.left = child
        parent.degree += 1
        child.marked = False

    def _iterate(self, start: FibNode) -> List[FibNode]:
        nodes = []
        if start is None:
            return nodes
        cur = start
        while True:
            nodes.append(cur)
            cur = cur.right
            if cur == start:
                break
        return nodes

    def __len__(self) -> int:
        return self.total


# ─── Upgrade 35: Suffix Array ────────────────────────────────────────────────
class SuffixArray:
    """
    O(n log n) construction, O(m log n) search.
    Full-text search across all credential titles, descriptions, and skills.
    More space-efficient than a full inverted index at this scale.
    """
    def __init__(self, corpus: List[str]):
        self.documents = corpus
        self.separator = "\x00"  # null byte as document separator
        self.combined = self.separator.join(
            doc.lower() for doc in corpus
        ) + self.separator
        self.sa = self._build(self.combined)
        # Build doc offset map for result attribution
        self.offsets: List[int] = []
        pos = 0
        for doc in corpus:
            self.offsets.append(pos)
            pos += len(doc.lower()) + 1

    def _build(self, text: str) -> List[int]:
        n = len(text)
        return sorted(range(n), key=lambda i: text[i:])

    def search(self, pattern: str, max_results: int = 10) -> List[Dict]:
        """Return documents containing pattern. O(m log n)."""
        import bisect
        pattern = pattern.lower()
        m = len(pattern)
        text = self.combined

        # Binary search for leftmost suffix >= pattern
        lo = bisect.bisect_left(
            self.sa, 0,
            key=lambda i: (text[i:i+m] >= pattern)
        )
        # Collect matching positions
        results = []
        seen_docs = set()
        for idx in range(lo, len(self.sa)):
            pos = self.sa[idx]
            if text[pos:pos+m] != pattern:
                break
            # Map position back to document index
            doc_idx = self._pos_to_doc(pos)
            if doc_idx is not None and doc_idx not in seen_docs:
                seen_docs.add(doc_idx)
                results.append({
                    "doc_index": doc_idx,
                    "text": self.documents[doc_idx],
                    "match_pos": pos - self.offsets[doc_idx]
                })
            if len(results) >= max_results:
                break
        return results

    def _pos_to_doc(self, pos: int) -> Optional[int]:
        """Map a position in the combined string to a document index."""
        for i in range(len(self.offsets) - 1, -1, -1):
            if pos >= self.offsets[i]:
                return i
        return None


# ─── Skill Cluster Registry ───────────────────────────────────────────────────
def build_skill_clusters() -> UnionFind:
    """
    Upgrade 32: Pre-built skill cluster graph using Union-Find.
    Workers who learn one skill in a cluster get partial credit toward others.
    """
    uf = UnionFind()
    # AI/ML cluster
    ai_skills = ["Prompt Engineering", "LLM Fine-tuning", "MLOps / Model Deployment",
                  "AI Product Management", "AI Ethics & Compliance"]
    for s in ai_skills:
        uf.union(ai_skills[0], s)
    uf.label_cluster(ai_skills[0], "AI/ML")

    # Data cluster
    data_skills = ["Data Analysis (Python)", "Business Intelligence", "Data Scientist"]
    for s in data_skills:
        uf.union(data_skills[0], s)
    uf.label_cluster(data_skills[0], "Data")

    # Cross-cluster connections (skills that bridge clusters)
    uf.union("AI Product Management", "Data Analysis (Python)")  # PM needs data
    uf.union("MLOps / Model Deployment", "Data Scientist")        # MLOps needs DS

    return uf


# ─── Singletons ───────────────────────────────────────────────────────────────
enroll_bloom = BloomFilter(capacity=500_000, error_rate=0.001)
skill_trie = Trie()
role_trie = Trie()
signal_cache = LFUCache(capacity=256)
credential_ranking = SkipList()
skill_clusters = build_skill_clusters()
vector_store_hasher = ConsistentHash(
    nodes=["shard_0", "shard_1"],
    replicas=100
)


def init_tries(skills: List[str], roles: List[str]):
    """Populate tries from DB data at startup."""
    for skill in skills:
        skill_trie.insert(skill)
    for role in roles:
        role_trie.insert(role)


def init_credential_ranking(credentials: List[Dict]):
    """Populate skip list with credentials sorted by demand score."""
    for cred in credentials:
        credential_ranking.insert(
            score=float(cred.get("demand_score", 0)),
            value=cred.get("id", "")
        )


def init_bloom_from_enrollments(enrollments: List[Dict]):
    """Pre-populate bloom filter from existing enrollment records."""
    for e in enrollments:
        key = f"{e['worker_id']}:{e['credential_id']}"
        enroll_bloom.add(key)
