"""
Career Graph Engine — models job roles as a weighted directed graph.
Uses Dijkstra's algorithm to find the optimal transition path
between any two roles, weighted by difficulty, time, and cost.
"""
import networkx as nx
from typing import List, Dict, Optional

# Build the career transition graph
G = nx.DiGraph()

# --- Role nodes (avg_salary in USD) ---
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

# --- Transition edges (from_role, to_role, difficulty 1-10, weeks, cost_usd) ---
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
    # Weight = difficulty score (Dijkstra finds lowest weight = easiest path)
    G.add_edge(from_role, to_role, weight=difficulty, weeks=weeks, cost=cost)


def find_career_path(from_role: str, to_role: str) -> Optional[Dict]:
    """
    Find the optimal career transition path using Dijkstra's algorithm.
    Returns path, total weeks, total cost, and salary uplift.
    """
    # Fuzzy match roles if exact match not found
    from_role = _fuzzy_match_role(from_role)
    to_role = _fuzzy_match_role(to_role)

    if from_role not in G or to_role not in G:
        return None

    try:
        path = nx.dijkstra_path(G, from_role, to_role, weight="weight")
        total_weeks = sum(G[path[i]][path[i+1]]["weeks"] for i in range(len(path)-1))
        total_cost = sum(G[path[i]][path[i+1]]["cost"] for i in range(len(path)-1))
        from_salary = G.nodes[from_role]["avg_salary"]
        to_salary = G.nodes[to_role]["avg_salary"]

        steps = []
        for i in range(len(path)-1):
            edge = G[path[i]][path[i+1]]
            steps.append({
                "from": path[i],
                "to": path[i+1],
                "weeks": edge["weeks"],
                "cost": edge["cost"],
                "difficulty": edge["weight"]
            })

        return {
            "path": path,
            "steps": steps,
            "total_weeks": total_weeks,
            "total_cost_usd": total_cost,
            "from_salary": from_salary,
            "to_salary": to_salary,
            "salary_uplift": to_salary - from_salary,
            "num_transitions": len(path) - 1
        }
    except nx.NetworkXNoPath:
        return None
    except nx.NodeNotFound:
        return None


def get_reachable_roles(from_role: str) -> List[Dict]:
    """Get all roles reachable from a given role with path costs."""
    from_role = _fuzzy_match_role(from_role)
    if from_role not in G:
        return []
    reachable = []
    for target in G.nodes:
        if target == from_role:
            continue
        try:
            path = nx.dijkstra_path(G, from_role, target, weight="weight")
            total_weeks = sum(G[path[i]][path[i+1]]["weeks"] for i in range(len(path)-1))
            total_cost = sum(G[path[i]][path[i+1]]["cost"] for i in range(len(path)-1))
            reachable.append({
                "role": target,
                "avg_salary": G.nodes[target]["avg_salary"],
                "total_weeks": total_weeks,
                "total_cost": total_cost,
                "salary_uplift": G.nodes[target]["avg_salary"] - G.nodes[from_role]["avg_salary"],
                "hops": len(path) - 1
            })
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue
    return sorted(reachable, key=lambda x: x["salary_uplift"], reverse=True)


def all_roles() -> List[str]:
    return list(G.nodes)


def _fuzzy_match_role(role: str) -> str:
    """Case-insensitive partial match against known roles."""
    if role in G:
        return role
    role_lower = role.lower()
    for node in G.nodes:
        if role_lower in node.lower() or node.lower() in role_lower:
            return node
    return role