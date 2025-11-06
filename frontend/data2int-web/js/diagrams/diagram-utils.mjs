function fitDiagram(cy) {
    cy.fit(null, 60);
}

function resetZoom(cy) {
    cy.zoom(1);
    cy.center();
}

function exportPNG(cy, filename = 'diagram.png') {
    const png = cy.png({ full: true, scale: 2, bg: '#383838cc' });
    const link = document.createElement('a');
    link.href = png;
    link.download = filename;
    link.click();
}

export {
    fitDiagram,
    resetZoom,
    exportPNG
}