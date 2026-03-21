"""
Career Graph Engine — upgraded with A* (31) and Fibonacci Heap (34).
A* uses salary gap as heuristic for 2-10x faster pathfinding on large graphs.
Fibonacci heap provides O(1) amortised decrease-key for optimal Dijkstra.
"""
import networkx as nx
from typing import List, Dict, Optional
from dsa_structures import astar_career_path, FibonacciHeap

# Build the career transition graph
G = nx.DiGraph()

roles = [
    ("Data Entry Clerk",        32000),
    ("Customer Service Rep",    38000),
    ("Admin Assistant",         40000),
    ("Retail Manager",          45000),
    ("HR Coordinator",          52000),
    ("Business Analyst",        75000),
    ("Data Analyst",            72000),
    ("Product Manager",         105000),
    ("AI Product Manager",      130000),
    ("Data Scientist",          120000),
    ("ML Engineer",             145000),
    ("LLM Engineer",            160000),
    ("Prompt Engineer",         95000),
    ("AI Consultant",           115000),
    ("AI Ethics Specialist",    98000),
]

for role, salary in roles:
    G.add_node(role, avg_salary=salary)

edges = [
    ("Data Entry Clerk",     "Data Analyst",         7, 16, 399),
    ("Data Entry Clerk",     "Prompt Engineer",      5, 6,  299),
    ("Customer Service Rep", "Prompt Engineer",      4, 6,  299),
    ("Customer Service Rep", "AI Consultant",        6, 20, 1499),
    ("Admin Assistant",      "HR Coordinator",       3, 8,  500),
    ("Admin Assistant",      "Business Analyst",     5, 16, 800),
    ("Retail Manager",       "Business Analyst",     5, 14, 800),
    ("Retail Manager",       "AI Product Manager",   7, 24, 2495),
    ("HR Coordinator",       "AI Ethics Specialist", 5, 12, 999),
    ("Business Analyst",     "Data Analyst",         4, 10, 399),
    ("Business Analyst",     "Product Manager",      4, 12, 1200),
    ("Data Analyst",         "Data Scientist",       6, 20, 1499),
    ("Data Analyst",         "AI Product Manager",   5, 12, 2495),
    ("Product Manager",      "AI Product Manager",   4, 12, 2495),
    ("Data Scientist",       "ML Engineer",          6, 16, 1499),
    ("Data Scientist",       "LLM Engineer",         7, 20, 1499),
    ("Prompt Engineer",      "AI Consultant",        4, 12, 999),
    ("Prompt Engineer",      "LLM Engineer",         6, 16, 1499),
    ("ML Engineer",          "LLM Engineer",         4, 8,  999),
    ("AI Consultant",        "AI Product Manager",   4, 10, 1200),
]

for from_role, to_role, difficulty, weeks, cost in edges:
    G.add_edge(from_role, to_role, weight=difficulty, weeks=weeks, cost=cost)


def find_career_path(from_role: str, to_role: str) -> Optional[Dict]:
    """
    Upgrade 31: Uses A* with salary-gap heuristic instead of plain Dijkstra.
    Falls back to networkx Dijkstra if A* fails.
    """
    from_role = _fuzzy_match_role(from_role)
    to_role = _fuzzy_match_role(to_role)

    if from_role not in G or to_role not in G:
        return None

    # Try A* first (upgrade 31)
    result = astar_career_path(G, from_role, to_role)
    if result:
        return result

    # Fallback to networkx Dijkstra
    try:
        path = nx.dijkstra_path(G, from_role, to_role, weight="weight")
        total_weeks = sum(G[path[i]][path[i+1]]["weeks"] for i in range(len(path)-1))
        total_cost = sum(G[path[i]][path[i+1]]["cost"] for i in range(len(path)-1))
        from_salary = G.nodes[from_role]["avg_salary"]
        to_salary = G.nodes[to_role]["avg_salary"]
        steps = [
            {
                "from": path[i], "to": path[i+1],
                "weeks": G[path[i]][path[i+1]]["weeks"],
                "cost": G[path[i]][path[i+1]]["cost"],
                "difficulty": G[path[i]][path[i+1]]["weight"],
            }
            for i in range(len(path) - 1)
        ]
        return {
            "path": path, "steps": steps,
            "total_weeks": total_weeks, "total_cost_usd": total_cost,
            "from_salary": from_salary, "to_salary": to_salary,
            "salary_uplift": to_salary - from_salary,
            "num_transitions": len(path) - 1,
            "algorithm": "Dijkstra",
        }
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def find_career_path_fib_heap(from_role: str, to_role: str) -> Optional[Dict]:
    """
    Upgrade 34: Dijkstra using Fibonacci heap for O(E + V log V) complexity.
    Theoretically optimal for dense graphs. Showcases Fibonacci heap
    decrease-key O(1) amortised operation.
    """
    from_role = _fuzzy_match_role(from_role)
    to_role = _fuzzy_match_role(to_role)
    if from_role not in G or to_role not in G:
        return None

    heap = FibonacciHeap()
    dist: Dict[str, float] = {node: float("inf") for node in G.nodes}
    prev: Dict[str, Optional[str]] = {node: None for node in G.nodes}
    nodes_in_heap: Dict[str, object] = {}  # node → FibNode reference

    dist[from_role] = 0.0
    for node in G.nodes:
        fib_node = heap.insert(dist[node], node)
        nodes_in_heap[node] = fib_node

    while len(heap) > 0:
        min_node = heap.extract_min()
        if min_node is None:
            break
        u = min_node.value
        if u == to_role:
            break
        if dist[u] == float("inf"):
            break
        for v in G.neighbors(u):
            weight = G[u][v].get("weight", 1)
            alt = dist[u] + weight
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                # Decrease-key: O(1) amortised with Fibonacci heap
                fib_v = nodes_in_heap.get(v)
                if fib_v:
                    try:
                        heap.decrease_key(fib_v, alt)
                    except Exception:
                        pass

    # Reconstruct path
    if dist[to_role] == float("inf"):
        return None
    path = []
    cur = to_role
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    if path[0] != from_role:
        return None

    total_weeks = sum(G[path[i]][path[i+1]].get("weeks", 0) for i in range(len(path)-1))
    total_cost = sum(G[path[i]][path[i+1]].get("cost", 0) for i in range(len(path)-1))
    from_salary = G.nodes[from_role].get("avg_salary", 0)
    to_salary = G.nodes[to_role].get("avg_salary", 0)
    steps = [
        {
            "from": path[i], "to": path[i+1],
            "weeks": G[path[i]][path[i+1]].get("weeks", 0),
            "cost": G[path[i]][path[i+1]].get("cost", 0),
            "difficulty": G[path[i]][path[i+1]].get("weight", 5),
        }
        for i in range(len(path) - 1)
    ]
    return {
        "path": path, "steps": steps,
        "total_weeks": total_weeks, "total_cost_usd": total_cost,
        "from_salary": from_salary, "to_salary": to_salary,
        "salary_uplift": to_salary - from_salary,
        "num_transitions": len(path) - 1,
        "algorithm": "Fibonacci-heap Dijkstra",
    }


def get_reachable_roles(from_role: str) -> List[Dict]:
    from_role = _fuzzy_match_role(from_role)
    if from_role not in G:
        return []
    reachable = []
    for target in G.nodes:
        if target == from_role:
            continue
        result = find_career_path(from_role, target)
        if result:
            reachable.append({
                "role": target,
                "avg_salary": G.nodes[target]["avg_salary"],
                "total_weeks": result["total_weeks"],
                "total_cost": result["total_cost_usd"],
                "salary_uplift": result["salary_uplift"],
                "hops": result["num_transitions"],
            })
    return sorted(reachable, key=lambda x: x["salary_uplift"], reverse=True)


def all_roles() -> List[str]:
    return list(G.nodes)


def _fuzzy_match_role(role: str) -> str:
    if role in G:
        return role
    role_lower = role.lower()
    for node in G.nodes:
        if role_lower in node.lower() or node.lower() in role_lower:
            return node
    return role
