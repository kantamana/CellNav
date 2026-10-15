# The core is a plain-data Spec; builder, Web Component and React wrapper are thin layers over it

The fluent builder is convenient in code, but other websites will embed CellNav through an HTML tag that can only pass attributes or JSON. We made the Spec (plain data) the single source of truth, so the builder, `<cell-nav>` and the React wrapper all produce or consume the same thing. The cost is that custom functions (for example a hand-written Layout) are only available through the builder.
