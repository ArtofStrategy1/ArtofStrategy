from sqlalchemy import (
    Column,
    BigInteger,
    Text,
    VARCHAR,
    DateTime,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import func

Base = declarative_base()


class KGNode(Base):
    __tablename__ = "kg_nodes"

    node_id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity_text = Column(Text, nullable=False)
    type = Column(VARCHAR(50), nullable=False)
    label = Column(Text, nullable=True)
    source_document_id = Column(Text, nullable=True)
    properties = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    __table_args__ = (
        # UNIQUE INDEX idx_kg_nodes_entity_text_type ON kg_nodes (entity_text, type);
        # SQLAlchemy handles unique constraints on columns directly or via UniqueConstraint
        # For a unique index that is not just a simple unique constraint on columns,
        # we might need to use Index directly.
        # For now, let's assume a simple unique constraint is sufficient for entity_text and type.
        # If a named unique index is strictly required, it can be added via Index.
        UniqueConstraint("entity_text", "type", name="idx_kg_nodes_entity_text_type"),
        # For explicit index creation with names, we can use Index
        Index("idx_kg_nodes_type", "type"),
        Index("idx_kg_nodes_source_document_id", "source_document_id"),
        Index("idx_kg_nodes_properties_gin", "properties", postgresql_using="gin"),
    )


class KGEdge(Base):
    __tablename__ = "kg_edges"

    edge_id = Column(BigInteger, primary_key=True, autoincrement=True)
    source_node_id = Column(BigInteger, ForeignKey("kg_nodes.node_id"), nullable=False)
    target_node_id = Column(BigInteger, ForeignKey("kg_nodes.node_id"), nullable=False)
    relation_type = Column(VARCHAR(100), nullable=False)
    source_sentence_id = Column(Text, nullable=True)
    source_document_id = Column(Text, nullable=True)
    weight = Column(Numeric(5, 2), default=1.0, nullable=True)
    properties = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    source_node = relationship(
        "KGNode", foreign_keys=[source_node_id], backref="outgoing_edges"
    )
    target_node = relationship(
        "KGNode", foreign_keys=[target_node_id], backref="incoming_edges"
    )

    __table_args__ = (
        # UNIQUE INDEX idx_kg_edges_unique_relation ON kg_edges (source_node_id, target_node_id, relation_type);
        UniqueConstraint(
            "source_node_id",
            "target_node_id",
            "relation_type",
            name="idx_kg_edges_unique_relation",
        ),
        Index("idx_kg_edges_source_node_id", "source_node_id"),
        Index("idx_kg_edges_target_node_id", "target_node_id"),
        Index("idx_kg_edges_relation_type", "relation_type"),
        Index("idx_kg_edges_source_document_id", "source_document_id"),
        Index("idx_kg_edges_properties_gin", "properties", postgresql_using="gin"),
    )
