# Render to SVG, not p5

The prototype draws with p5 on a canvas and recomputes every frame. Now that Seeds are fixed and the result is a navbar, we render once to SVG: each Cell is a real `<a>`, which gives native links, keyboard focus and screen-reader support, and p5 (about 1 MB) is dropped from the embeddable bundle. If Nested Layouts need more than about five levels, the SVG node count may force a canvas renderer with an invisible SVG layer for links; the default depth cap of 3 keeps us clear of that.
