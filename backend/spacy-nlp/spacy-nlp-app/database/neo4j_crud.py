import logging
from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional

from ..database.neo4j_connection import get_neo4j_driver
from ..database.neo4j_models import Node, Relationship, KnowledgeGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Neo4jCRUD:
    def __init__(self):
        self._driver = get_neo4j_driver()

    def _execute_query(self, query: str, parameters: Dict[str, Any] = None):
        with self._driver.session() as session:
            result = session.run(query, parameters)
            return [record for record in result]

    def create_node(self, node: Node) -> Node:
        query = (
            f"MERGE (n:{node.label} {{id: $id}})"
            "ON CREATE SET n += $properties "
            "ON MATCH SET n += $properties "
            "RETURN n"
        )
        parameters = {"id": node.id, "properties": node.properties}
        result = self._execute_query(query, parameters)
        # Check if result is not empty
        if result:
            created_node_data = result[0]["n"]
        else:
            # Handle the case where no node was created/returned, perhaps raise an error or return None
            raise Exception("Node creation failed or no node returned.")
        node.id = created_node_data.get("id") or created_node_data.element_id # Use element_id if custom id not set
        return node

    def create_relationship(self, relationship: Relationship) -> Relationship:
        # Optimized query to avoid Cartesian product and use dynamic relationship type
        query = (
            f"MATCH (a:`{relationship.source_label}` {{id: $source_id}}) "
            f"MATCH (b:`{relationship.target_label}` {{id: $target_id}}) "
            f"MERGE (a)-[r:`{relationship.type}`]->(b) " # Use backticks for dynamic relationship type
            "ON CREATE SET r += $properties "
            "ON MATCH SET r += $properties "
            "RETURN r"
        )
        parameters = {
            "source_id": relationship.source_id,
            "target_id": relationship.target_id,
            "properties": relationship.properties,
        }
        # logger.info(f"SourceLabel: {relationship.source_label}")
        # logger.info(f"TargetLabel: {relationship.target_label}")
        # logger.info(f"RelationshipType: {relationship.type}")
        # logger.info(f"Parameters: {parameters}")

        result = self._execute_query(query, parameters)
        # logger.info(f"Relationship Result: {result}")

        if result: # Check if result is not empty
            created_relationship_data = result[0]["r"]
        else:
            raise Exception("Relationship creation failed or no relationship returned.")
        relationship.id = created_relationship_data.element_id
        return relationship

    def get_node(self, node_id: str, label: Optional[str] = None) -> Optional[Node]:
        label_clause = f":`{label}`" if label else "" # Use backticks for dynamic label
        query = f"MATCH (n{label_clause} {{id: $node_id}}) RETURN n"
        parameters = {"node_id": node_id}
        result = self._execute_query(query, parameters)
        if result:
            node_data = result[0]["n"]
            return Node(
                id=node_data.get("id") or node_data.element_id,
                label=next(iter(node_data.labels)) if node_data.labels else "Node",
                properties=dict(node_data)
            )
        return None

    def get_all_nodes(self, label: Optional[str] = None) -> List[Node]:
        label_clause = f":`{label}`" if label else "" # Use backticks for dynamic label
        query = f"MATCH (n{label_clause}) RETURN n"
        result = self._execute_query(query)
        nodes = []
        for record in result:
            node_data = record["n"]
            nodes.append(Node(
                id=node_data.get("id") or node_data.element_id,
                label=next(iter(node_data.labels)) if node_data.labels else "Node",
                properties=dict(node_data)
            ))
        return nodes

    def get_relationships_for_node(self, node_id: str) -> List[Relationship]:
        query = (
            f"MATCH (a {{id: $node_id}})-[r]->(b) "
            "RETURN a, r, b"
        )
        parameters = {"node_id": node_id}
        result = self._execute_query(query, parameters)
        relationships = []
        for record in result:
            r_data = record["r"]
            source_node_data = record["a"]
            target_node_data = record["b"]
            relationships.append(Relationship(
                id=r_data.element_id,
                source_id=source_node_data.get("id") or source_node_data.element_id,
                target_id=target_node_data.get("id") or target_node_data.element_id,
                type=r_data.type,
                properties=dict(r_data)
            ))
        return relationships

    def create_knowledge_graph(self, graph: KnowledgeGraph):
        for node in graph.nodes:
            self.create_node(node)
        for relationship in graph.relationships:
            self.create_relationship(relationship)

    def delete_node(self, node_id: str):
        query = "MATCH (n {id: $node_id}) DETACH DELETE n"
        parameters = {"node_id": node_id}
        self._execute_query(query, parameters)

    def delete_relationship(self, relationship_id: str):
        query = "MATCH ()-[r]->() WHERE elementId(r) = $relationship_id DELETE r"
        parameters = {"relationship_id": relationship_id}
        self._execute_query(query, parameters)

    def clear_database(self):
        query = "MATCH (n) DETACH DELETE n"
        self._execute_query(query)
        print("Neo4j database cleared.")
