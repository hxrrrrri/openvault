# Graph Engine

The graph model uses notes as nodes and resolved links as edges. Backlinks and unresolved links are derived from the same link table.

The MVP frontend renderer uses Canvas 2D with:

- requestAnimationFrame drawing
- zoom and pan transform
- node hover/click hit testing
- label culling
- selected-node pulse
- semantic and unresolved edge styling

The command payload is renderer-neutral so a later WebGL or WebGPU renderer can replace Canvas.
