def find_lca(ent1_root, ent2_root):
    """
    Finds the lowest common ancestor (LCA) of two spaCy tokens in the dependency tree.
    """
    lca = None
    for ancestor in ent1_root.ancestors:
        if ancestor.is_ancestor(ent2_root):
            lca = ancestor
            break
    if lca is None:
        for ancestor in ent2_root.ancestors:
            if ancestor.is_ancestor(ent1_root):
                lca = ancestor
                break
    if lca is None:
        if ent1_root.is_ancestor(ent2_root):
            lca = ent1_root
        elif ent2_root.is_ancestor(ent1_root):
            lca = ent2_root
    return lca
