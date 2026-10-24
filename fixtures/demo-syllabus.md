# CSE 134R — React Fundamentals (Fall 2026)

Instructor: Prof. Rivera · 4 weeks · Prerequisite: JavaScript (ES2020+)

## Course goal
Students build small React apps and can explain *why* their code works, not just copy it.

## Module 1 — Foundations
1. **JSX & Components.** How JSX compiles to function calls; splitting a UI into reusable components.
   *Mastery:* explain what JSX compiles to and decompose a mockup into components.
2. **Props.** Passing data and callbacks down; one-way data flow; the `children` prop.
   *Mastery:* pass data and callbacks through props and explain one-way data flow.
3. **State with useState.** Declaring state, functional updates, why updates are asynchronous.
   *Mastery:* use useState correctly, including functional updates.

## Module 2 — Effects & Data
4. **React useEffect.** Side effects, the dependency array, cleanup functions, and infinite render loops.
   *Mastery:* identify and prevent an infinite render loop caused by a missing or wrong dependency array.
   *Requires:* State with useState.
5. **Data Fetching.** Fetching in an effect with loading/error states; avoiding race conditions.
   *Requires:* React useEffect.
6. **Custom Hooks.** Extracting reusable stateful logic; the rules of hooks.
   *Requires:* React useEffect.

## Module 3 — Building Apps
7. **Context API.** createContext/useContext; when context beats prop drilling.
   *Requires:* State with useState.
8. **Performance & Memoization.** React.memo, useMemo, useCallback; avoiding unnecessary re-renders.
   *Requires:* Custom Hooks, Context API.

## Assessment
Weekly mini-projects (60%), concept checks (20%), final app (20%).

## AI policy
AI assistants are allowed **through Friction only**. Friction adjusts how much help the AI gives based on
your demonstrated mastery of each concept above.
