# Working on this repository

## Research first, then implement

Before building or reworking a feature, read the research papers and check the open-source projects
that tackle the same problem, then implement the code.

- Look for the published methods (papers, manufacturers' and standard references) and for how
  established open-source projects do it; read their source where it's available, not just their docs.
- Use primary sources for any figures or specs the app shows (a maker's own recommendation, not a
  forum's retelling of it). Where only a secondary source can be had, say so in the code and the README.
- Cite the sources: in a comment at the top of the module, and in the README section for the feature.
- Check the result against real data, not only synthetic tests (e.g. `web/test/realguitar.test.js`
  runs the tuner on real guitar recordings), and compare it with what it replaces.
