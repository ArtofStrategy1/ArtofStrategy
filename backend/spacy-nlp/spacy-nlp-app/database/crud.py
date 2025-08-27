from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.dialects.postgresql import JSONB
from .models import KGNode, KGEdge


# CRUD operations for KGNode
async def create_kg_node(
    session: AsyncSession,
    entity_text: str,
    type: str,
    label: Optional[str] = None,
    source_document_id: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
) -> KGNode:
    """
    Creates a new knowledge graph node.
    """
    new_node = KGNode(
        entity_text=entity_text,
        type=type,
        label=label,
        source_document_id=source_document_id,
        properties=properties,
    )
    session.add(new_node)
    await session.commit()
    await session.refresh(new_node)
    return new_node


async def get_kg_node_by_id(session: AsyncSession, node_id: int) -> Optional[KGNode]:
    """
    Retrieves a knowledge graph node by its ID.
    """
    result = await session.execute(select(KGNode).where(KGNode.node_id == node_id))
    return result.scalar_one_or_none()


async def get_kg_node_by_text_and_type(
    session: AsyncSession, entity_text: str, type: str
) -> Optional[KGNode]:
    """
    Retrieves a knowledge graph node by its entity text and type.
    """
    result = await session.execute(
        select(KGNode).where(KGNode.entity_text == entity_text, KGNode.type == type)
    )
    return result.scalar_one_or_none()


async def update_kg_node(
    session: AsyncSession,
    node_id: int,
    label: Optional[str] = None,
    source_document_id: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
) -> Optional[KGNode]:
    """
    Updates an existing knowledge graph node's properties.
    """
    stmt = (
        update(KGNode)
        .where(KGNode.node_id == node_id)
        .values(
            label=label,
            source_document_id=source_document_id,
            properties=properties,
        )
        .returning(KGNode)
    )
    result = await session.execute(stmt)
    updated_node = result.scalar_one_or_none()
    if updated_node:
        await session.commit()
        await session.refresh(updated_node)
    return updated_node


async def delete_kg_node(session: AsyncSession, node_id: int) -> bool:
    """
    Deletes a knowledge graph node by its ID.
    """
    stmt = delete(KGNode).where(KGNode.node_id == node_id)
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0


# CRUD operations for KGEdge
async def create_kg_edge(
    session: AsyncSession,
    source_node_id: int,
    target_node_id: int,
    relation_type: Optional[str] = None,
    confidence: Optional[float] = None,
    relation_metadata: Optional[Dict[str, Any]] = None,
    source_sentence_id: Optional[str] = None,
    source_document_id: Optional[str] = None,
    weight: Optional[float] = None,
    properties: Optional[Dict[str, Any]] = None,
) -> KGEdge:
    """
    Creates a new knowledge graph edge.
    """
    new_edge = KGEdge(
        source_node_id=source_node_id,
        target_node_id=target_node_id,
        relation_type=relation_type,
        confidence=confidence,
        relation_metadata=relation_metadata,
        source_sentence_id=source_sentence_id,
        source_document_id=source_document_id,
        weight=weight,
        properties=properties,
    )
    session.add(new_edge)
    await session.commit()
    await session.refresh(new_edge)
    return new_edge


async def get_kg_edge_by_id(session: AsyncSession, edge_id: int) -> Optional[KGEdge]:
    """
    Retrieves a knowledge graph edge by its ID.
    """
    result = await session.execute(select(KGEdge).where(KGEdge.edge_id == edge_id))
    return result.scalar_one_or_none()


async def get_kg_edge_by_nodes_and_type(
    session: AsyncSession, source_node_id: int, target_node_id: int, relation_type: str
) -> Optional[KGEdge]:
    """
    Retrieves a knowledge graph edge by its source node ID, target node ID, and relation type.
    """
    result = await session.execute(
        select(KGEdge).where(
            KGEdge.source_node_id == source_node_id,
            KGEdge.target_node_id == target_node_id,
            KGEdge.relation_type == relation_type,
        )
    )
    return result.scalar_one_or_none()


async def get_kg_edges_by_source_node(
    session: AsyncSession, source_node_id: int
) -> List[KGEdge]:
    """
    Retrieves knowledge graph edges by source node ID.
    """
    result = await session.execute(
        select(KGEdge).where(KGEdge.source_node_id == source_node_id)
    )
    return result.scalars().all()


async def get_kg_edges_by_target_node(
    session: AsyncSession, target_node_id: int
) -> List[KGEdge]:
    """
    Retrieves knowledge graph edges by target node ID.
    """
    result = await session.execute(
        select(KGEdge).where(KGEdge.target_node_id == target_node_id)
    )
    return result.scalars().all()


async def get_kg_edges_by_relation_type(
    session: AsyncSession, relation_type: str
) -> List[KGEdge]:
    """
    Retrieves knowledge graph edges by relation type.
    """
    result = await session.execute(
        select(KGEdge).where(KGEdge.relation_type == relation_type)
    )
    return result.scalars().all()


async def update_kg_edge(
    session: AsyncSession,
    edge_id: int,
    relation_type: Optional[str] = None,
    confidence: Optional[float] = None,
    relation_metadata: Optional[Dict[str, Any]] = None,
    source_sentence_id: Optional[str] = None,
    source_document_id: Optional[str] = None,
    weight: Optional[float] = None,
    properties: Optional[Dict[str, Any]] = None,
) -> Optional[KGEdge]:
    """
    Updates an existing knowledge graph edge's properties.
    """
    stmt = (
        update(KGEdge)
        .where(KGEdge.edge_id == edge_id)
        .values(
            relation_type=relation_type,
            confidence=confidence,
            relation_metadata=relation_metadata,
            source_sentence_id=source_sentence_id,
            source_document_id=source_document_id,
            weight=weight,
            properties=properties,
        )
        .returning(KGEdge)
    )
    result = await session.execute(stmt)
    updated_edge = result.scalar_one_or_none()
    if updated_edge:
        await session.commit()
        await session.refresh(updated_edge)
    return updated_edge


async def delete_kg_edge(session: AsyncSession, edge_id: int) -> bool:
    """
    Deletes a knowledge graph edge by its ID.
    """
    stmt = delete(KGEdge).where(KGEdge.edge_id == edge_id)
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0
