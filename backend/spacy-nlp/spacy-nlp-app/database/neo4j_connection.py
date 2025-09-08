import os
import logging
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEO4JDB_URI = os.getenv("NEO4JDB_URI", "bolt://localhost:7687")
NEO4JDB_USERNAME = os.getenv("NEO4JDB_USERNAME", "neo4j")
NEO4JDB_PASSWORD = os.getenv("NEO4JDB_PASSWORD", "password")

class Neo4jConnection:
    def __init__(self, uri, user, password):
        self._uri = uri
        self._user = user
        self._password = password
        self._driver = None

    def connect(self):
        if self._driver is None:
            try:
                self._driver = GraphDatabase.driver(self._uri, auth=(self._user, self._password))
                self._driver.verify_connectivity()
                logger.info("Neo4j connection established.")
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j: {e}")
                self._driver = None
        return self._driver

    def close(self):
        if self._driver is not None:
            self._driver.close()
            self._driver = None
            logger.info("Neo4j connection closed.")

    def get_driver(self):
        return self._driver

# Global instance for convenience
neo4j_connection = Neo4jConnection(NEO4JDB_URI, NEO4JDB_USERNAME, NEO4JDB_PASSWORD)

def get_neo4j_driver():
    driver = neo4j_connection.get_driver()
    if driver is None:
        neo4j_connection.connect()
        driver = neo4j_connection.get_driver()
    return driver
