import logging
from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional

from ..database.neo4j_connection import get_neo4j_driver
from ..database.neo4j_models import Node, Relationship, KnowledgeGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Neo4jCRUD:
    def __init__(self, user_id: str):
        self._driver = get_neo4j_driver()
        self._user_id = user_id

    def _execute_query(self, query: str, parameters: Dict[str, Any] = None):
        with self._driver.session() as session:
            result = session.run(query, parameters)
            return [record for record in result]

    def create_node(self, node: Node) -> Node:
        if self._user_id:
            node.properties["user_id"] = self._user_id

        query = (
            f"MERGE (n:{node.label} {{id: $id, user_id: $user_id}}) " # Include user_id in MERGE
            "ON CREATE SET n += $properties "
            "ON MATCH SET n += $properties "
            "RETURN n"
        )

        parameters = {"id": node.id, "user_id": self._user_id, "properties": node.properties}
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
            f"MATCH (a:`{relationship.source_label}` {{id: $source_id, user_id: $user_id}}) "
            f"MATCH (b:`{relationship.target_label}` {{id: $target_id, user_id: $user_id}}) "
            f"MERGE (a)-[r:`{relationship.type}`]->(b) " # Use backticks for dynamic relationship type
            "ON CREATE SET r += $properties, r.user_id = $user_id "
            "ON MATCH SET r += $properties, r.user_id = $user_id "
            "RETURN r"
        )

        parameters = {
            "source_id": relationship.source_id,
            "target_id": relationship.target_id,
            "user_id": self._user_id,
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
        query = (
            f"MATCH (n{label_clause} {{id: $node_id}}) "
            "WHERE n.user_id = $user_id "
            "RETURN n"
        )

        parameters = {"node_id": node_id, "user_id": self._user_id}
        result = self._execute_query(query, parameters)

        if result:
            node_data = result[0]["n"]
            return Node(
                id=node_data.get("id") or node_data.element_id,
                label=next(iter(node_data.labels)) if node_data.labels else "Node",
                user_id=self._user_id,
                properties=dict(node_data)
            )
        
        return None


    def get_all_nodes(self, label: Optional[str] = None) -> List[Node]:
        label_clause = f":`{label}`" if label else "" # Use backticks for dynamic label
        query = (
            f"MATCH (n{label_clause}) "
            "WHERE n.user_id = $user_id "
            "RETURN n"
        )

        parameters = {"user_id": self._user_id}
        result = self._execute_query(query, parameters)

        nodes = []
        for record in result:
            node_data = record["n"]
            nodes.append(Node(
                id=node_data.get("id") or node_data.element_id,
                label=next(iter(node_data.labels)) if node_data.labels else "Node",
                user_id=self._user_id,
                properties=dict(node_data)
            ))
        return nodes

    def get_relationships_for_node(self, node_id: str) -> List[Relationship]:
        query = (
            f"MATCH (a {{id: $node_id, user_id: $user_id}})-[r]->(b) "
            "WHERE r.user_id = $user_id AND b.user_id = $user_id "
            "RETURN a, r, b"
        )

        parameters = {"node_id": node_id, "user_id": self._user_id}
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
                user_id=self._user_id,
                properties=dict(r_data)
            ))
        return relationships

    def search_nodes_fulltext(self, query_text: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Performs a full-text search on nodes using the 'entityTextIndex'.
        Returns a list of dictionaries, each containing the node's properties and its search score.
        This method will execute a Cypher query that uses the `entityTextIndex` to find nodes matching 
        the `query_text` and return their properties along with a relevance score.
        """
        cypher = """
        CALL db.index.fulltext.queryNodes("entityTextIndex", $query) YIELD node, score
        WHERE node.user_id = $user_id
        RETURN properties(node) AS node_properties, score
        ORDER BY score DESC
        LIMIT $limit
        """

        parameters = {"query": query_text, "user_id": self._user_id, "limit": limit}
        results = self._execute_query(cypher, parameters)

        return [{"node_properties": record["node_properties"], "score": record["score"]} for record in results]


    def create_knowledge_graph(self, graph: KnowledgeGraph):
        for node in graph.nodes:
            self.create_node(node)
        for relationship in graph.relationships:
            self.create_relationship(relationship)


    def delete_node(self, node_id: str):
        query = "MATCH (n {id: $node_id}) WHERE n.user_id = $user_id DETACH DELETE n"
        parameters = {"node_id": node_id, "user_id": self._user_id}
        self._execute_query(query, parameters)


    def delete_relationship(self, relationship_id: str):
        query = "MATCH ()-[r]->() WHERE elementId(r) = $relationship_id  AND r.user_id = $user_id DELETE r"
        parameters = {"relationship_id": relationship_id, "user_id": self._user_id}
        self._execute_query(query, parameters)


    def clear_database(self):
        query = "MATCH (n) WHERE n.user_id = $user_id DETACH DELETE n"
        parameters = {"user_id": self._user_id}
        self._execute_query(query, parameters)
        print("Neo4j database cleared.")
