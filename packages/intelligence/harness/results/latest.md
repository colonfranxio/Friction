# Harness results

Run: 2026-10-24T18:27:18.030Z · models: chat=claude-opus-5-5 grade=claude-opus-5-5 classify=claude-haiku-5-5 parse=claude-opus-5-5

## Summary

- L1: **5/5** (CP2 gate ≥4)
- L2: **5/5** (CP2 gate ≥4)
- L3: **5/5** (CP3 gate ≥4)
- L4: **5/5** (CP2 gate ≥4)
- Demo answer vs the real L1 quizzes: **5/5** correct
- Grading: **5/5** match
- Classify fallback: **3/3**
- Parse text: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 9868ms)
- Parse pdf: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 9946ms)
- 3-turn exchange: **pass** (automatic checks; read the transcript for naturalness)

## Level compliance (`DEMO_PROMPTS.question`)

### L1: 5/5

<details><summary>#1 pass · first token 1803ms · total 5025ms</summary>

Infinite loops with `useEffect` almost always come from one specific interaction, and you can probably spot it in your own code once you see the pattern.

**Hint:** Think about the cycle. Something causes your component to render, the effect runs after that render, and then the effect does something. If that "something" causes *another* render, and nothing tells React the effect doesn't need to run again, the cycle never ends. The second argument you pass to `useEffect` (or leave out) is what controls whether the effect runs again.

Some things to check in your code:
- Does your effect update state?
- What, if anything, is in the array after your effect function?
- If you have an array, do any of its items get *recreated* on every render, like objects, arrays, or functions defined inside the component?

Before you change anything, put this into words: what decides *when* a `useEffect` runs again after the first render?

</details>

<details><summary>#2 pass · first token 1513ms · total 3797ms</summary>

Infinite loops with `useEffect` are a common snag, and once you see what's driving the loop, the fix usually becomes obvious.

**Hint:** Look closely at what your effect *does* (especially whether it updates state) and at what you've told React to *watch* before re-running it. Then trace the cycle: render → effect runs → something changes → render again. Where does that chain fail to stop?

It also helps to check whether the effect has a dependency array at all, and if it does, whether anything in it is recreated on every render.

In your own words, what decides when a `useEffect` runs again after a render?

</details>

<details><summary>#3 pass · first token 1786ms · total 4507ms</summary>

Infinite `useEffect` loops almost always come from the same chain of events, so let's figure out where your chain is.

**A hint:** Think about what happens, step by step, when your effect updates some state. Updating state triggers a re-render, and after every render React decides whether to run your effect again. The **dependency array** (the second argument to `useEffect`) controls that decision. So ask yourself:

- Does your effect have a dependency array at all? If not, when will it run?
- If it does, does anything in that array change *because of* the effect itself?
- Are any dependencies objects, arrays, or functions created fresh on every render? Even if they look the same, React may not treat them as equal.

If you trace that cycle (render → effect → state change → render…), you'll usually find the exact spot where it never settles.

To get started, in your own words, what do you understand `useEffect` to be doing, and when does React decide to run it?

</details>

<details><summary>#4 pass · first token 1815ms · total 3369ms</summary>

Infinite loops with `useEffect` are a classic stumbling block, and once the underlying idea clicks, the fix usually becomes obvious.

**Hint:** Look at what your effect *does* (especially whether it updates any state), and then look at what tells React *when* to run the effect again. What happens when those two connect in a circle?

In your own words, what decides when a `useEffect` runs again after a render?

</details>

<details><summary>#5 pass · first token 1563ms · total 3785ms</summary>

Infinite loops with `useEffect` are a common stumbling block, and once you see the pattern they're much easier to spot.

**Hint:** Look closely at what your effect *does* (for example, does it update some state?) and then at what tells React *when* to run the effect again. If the effect's own work triggers the condition that makes it run again, you get a cycle. That second argument to `useEffect` matters here, and so does whether it's there at all.

You'll also get more out of it if you work through the "why" first. In your own words, what does `useEffect` do, and how does React decide when to run it?

</details>

### L2: 5/5

<details><summary>#1 pass · first token 1901ms · total 10436ms</summary>

An infinite `useEffect` loop almost always comes from this cycle:

1. The component renders.
2. The effect runs.
3. The effect **updates state**.
4. The state update triggers a **new render**, and you're back at step 1.

The way to break it is to control **when** the effect is allowed to re-run. That's the job of the dependency array.

### Step 1: Check whether you have a dependency array at all

```
useEffect( () => {
    ...do something...
    ...maybe set some state...
}, ____ )   <-- what goes here?
```

How the second argument changes behavior:

| Second argument | When the effect runs |
|---|---|
| *(nothing)* | After **every** render |
| `[ ]` (empty) | Only **once**, after the first render |
| `[ a, b ]` | After the first render, then only when `____` changes |

If you leave it out entirely *and* set state inside the effect, you get the loop.

### Step 2: Make sure the effect doesn't depend on what it changes

A common trap:

```
effect:
    set ____ to (something based on ____)
dependencies: [ ____ ]
```

If the same value appears in all three blanks, the effect changes the value, the value is a dependency, so the effect runs again, and so on forever. Ask yourself:

- Does this effect really need to re-run when that value changes?
- Could I use the **functional form** of the setter (`setX( prev => ____ )`) so I don't need the value as a dependency?

### Step 3: Watch out for values that are "new" on every render

Objects, arrays, and functions created inside the component body get a **new identity every render**, even if their contents look identical:

```
const options = { ... }        <-- recreated each render
useEffect( ..., [ options ] )  <-- React sees a "change" every time
```

Possible fixes:

- Move the object or function **outside** the component, or **inside** the effect.
- Depend on the **primitive values** inside it (`options.____`) instead of the whole object.
- Memoize it with `useMemo` or `useCallback` so its identity stays stable.

### Debugging checklist

- [ ] Is there a dependency array?
- [ ] Is any state I *set* in the effect also listed as a *dependency*?
- [ ] Are any dependencies objects, arrays, or functions created during render?
- [ ] Does the effect only need to run once (`[ ]`), or in response to specific values?

Try filling in the blanks with your actual code. If it's still looping, paste the effect and I'll help you spot which step applies.

In your own words, what is the dependency array telling React about when your effect should run?

</details>

<details><summary>#2 pass · first token 2420ms · total 10426ms</summary>

An infinite loop with `useEffect` almost always follows this cycle:

```
render → effect runs → effect updates state → state change triggers render → effect runs again → ...
```

To break it, figure out **why the effect re-runs after every render**. There are three common causes.

---

### Cause 1: No dependency array at all

Without a dependency array, the effect runs after *every* render. If it sets state, the loop is guaranteed.

Pseudocode outline:

```
useEffect(
  function:
    fetch some data
    setData(result)
  ,
  ____   ← what goes here to say "only run when certain things change"?
)
```

**Fill in:** What should you pass so the effect runs only **once**, after the first render? What should you pass so it runs only when a specific value (like `userId`) changes?

---

### Cause 2: The effect updates a value it also depends on

```
useEffect(
  function:
    setCount(count + 1)
  ,
  [ count ]
)
```

Here `count` changes, the effect runs, it changes `count` again, and so on.

**Ask yourself:**
- Does this effect *really* need to run when `____` changes?
- Could this logic be moved into an event handler instead of an effect?
- If you need the previous value, could you use the updater form: `setCount( ____ => ____ )` so `count` doesn't have to be a dependency?

---

### Cause 3: A dependency that's "new" on every render

Objects, arrays, and functions created inside the component body get a **new identity** on each render, even if their contents look identical.

```
component:
  options = { page: 1 }          ← new object every render

  useEffect(
    function: load(options)
    ,
    [ options ]                  ← always "changed" → always re-runs
  )
```

**Possible fixes to explore:**
- Depend on the primitive inside instead: `[ ____ ]`
- Move the object/function **outside** the component, or **inside** the effect
- Memoize it with `useMemo` / `useCallback` so its identity stays stable between renders

---

### Debugging checklist

1. Does the effect have a dependency array? ☐
2. Does the effect set any state that appears in its own dependency list? ☐
3. Are any dependencies objects, arrays, or functions defined during render? ☐
4. Does the ESLint `react-hooks/exhaustive-deps` rule flag anything? ☐

If you share your actual effect, we can walk through which of these applies.

In your own words, what is `useEffect` actually for, and when does React decide to run it?

</details>

<details><summary>#3 pass · first token 1752ms · total 10810ms</summary>

An infinite `useEffect` loop almost always comes from the same cycle:

1. The component renders.
2. The effect runs **after** the render.
3. The effect updates state (or creates something new).
4. That update triggers **another render**, so the effect runs again, and so on.

The fix is to tell React **when** the effect should run, using the dependency array.

### Step 1: Find which pattern you're in

**Pattern A: No dependency array at all**

```
useEffect(() => {
  ____ (some state update)
})   // <- nothing here
```

With no array, the effect runs after **every** render. If it sets state, you get a loop.
→ Fix: add a dependency array: `}, [____])`

**Pattern B: The effect updates a value it also depends on**

```
useEffect(() => {
  setCount( ____ )
}, [count])
```

Changing `count` re-triggers the effect, which changes `count` again.
→ Ask yourself: *should this really react to its own output?* Usually you want it to depend on something **else** (like a prop or an ID), or you need a **condition** that stops the update:

```
if ( ____ ) {
  setCount( ____ )
}
```

**Pattern C: An object, array, or function in the dependencies**

```
const options = { ____ }        // created fresh every render
useEffect(() => { ... }, [options])
```

React compares dependencies by **reference**. A new `{}` or `() => {}` is "different" every render, even if its contents are the same.
→ Fixes to consider:

- Move the object/function **inside** the effect.
- Depend on the **primitive values** instead (e.g., `options.id` rather than `options`).
- Memoize it with `useMemo` / `useCallback` so its reference stays stable.

### Step 2: Choose the right dependency array

| You want the effect to run... | Dependency array |
|---|---|
| Once, after the first render | `[ ____ ]` (what goes here?) |
| Whenever a specific value changes | `[ ____ ]` (list that value) |
| After every render | (no array, rarely what you want) |

### Step 3: Check your work

- Does every value **read inside** the effect appear in the array? (The `react-hooks/exhaustive-deps` lint rule helps with this.)
- Does the effect **set** any of the values it lists? If so, is there a condition that stops it?
- Are any dependencies objects or functions recreated on each render?

If you paste your effect, I can help you work out which pattern it matches.

In your own words, what determines when a `useEffect` runs again?

</details>

<details><summary>#4 pass · first token 1367ms · total 9446ms</summary>

An infinite `useEffect` loop almost always follows this cycle:

1. The component renders.
2. The effect runs.
3. The effect **updates state** (or creates a new object/array/function).
4. The state change triggers a **re-render**.
5. React decides the effect needs to run again, and you're back at step 2.

To break the loop, you need to control **when React re-runs the effect**. That's the job of the **dependency array**, the second argument to `useEffect`.

### Common Causes and Fixes

**Cause 1: No dependency array at all**

```
useEffect( () => {
    setSomething(____)
} )    // ← nothing here
```

With no second argument, the effect runs after *every* render. Ask yourself: *Should this run once on mount, or only when a specific value changes?*

- Once on mount → pass a dependency array containing `____`
- When a value changes → pass an array containing `____`

**Cause 2: Depending on the same state the effect sets**

```
useEffect( () => {
    setCount( count + 1 )
}, [ count ] )
```

The effect changes `count`, and `count` is a dependency, so the effect runs again. To fix it, decide whether the effect *should* react to that value at all. If you only need the previous value, consider the **functional updater form** of the setter: `setCount( ____ => ____ )`, which removes the need to list `count`.

**Cause 3: Objects, arrays, or functions as dependencies**

```
const options = { page: 1 }          // created fresh every render
useEffect( () => { fetchData(options) }, [ options ] )
```

React compares dependencies by **reference**. A new object on every render looks "changed" every time. Fixes to consider:

- Depend on the **primitive values** inside instead: `[ ____.page ]`
- Move the object **inside** the effect or **outside** the component
- Stabilize it with a memoization hook: `____( () => ({ page: 1 }), [ ____ ] )`
- For functions, stabilize with `____` or define them inside the effect

### Debugging Checklist

- [ ] Does my `useEffect` have a second argument?
- [ ] Am I setting a piece of state that's also in my dependency list?
- [ ] Are any dependencies objects, arrays, or functions recreated each render?
- [ ] Is the linter's "exhaustive-deps" warning pointing at something?

Try filling in the blanks for whichever cause matches your code. If you share your effect, I can help you figure out which pattern you're hitting.

In your own words, what determines when React decides to re-run a `useEffect`?

</details>

<details><summary>#5 pass · first token 2018ms · total 11512ms</summary>

An infinite loop with `useEffect` almost always follows the same cycle:

1. The component renders.
2. The effect runs.
3. The effect **updates state** (or something that triggers a re-render).
4. React re-renders, and if nothing tells it otherwise, the effect runs **again**, back to step 2.

To break the cycle, you need to control **when** the effect is allowed to re-run. That's what the dependency array is for.

---

### Step 1: Diagnose which case you're in

| Symptom | Likely cause |
|---|---|
| No second argument passed to `useEffect` at all | Effect runs after **every** render |
| Dependency array includes the same state the effect sets | Effect changes X → X changed → effect runs |
| Dependency array includes an object, array, or function created inside the component | It's a **new reference** every render, so React thinks it "changed" |

---

### Step 2: Fill in the outline

**Case A: Run once, on mount (e.g., initial data fetch)**

```
useEffect(() => {
    fetch some data
    then ____ (update state with the result)
}, ____ )   // what goes here so it only runs once?
```

**Case B: Re-run only when a specific value changes**

```
useEffect(() => {
    do something based on ____
}, [ ____ ])   // list only the values the effect actually READS
```

Ask yourself: *Does the effect write to any value that's also in this list?* If yes, that's your loop.

**Case C: The dependency is an object/array/function**

```
// Problem: this is recreated every render
const options = { ... }

useEffect(() => {
    use options
}, [options])   // new reference each time → runs every render
```

Possible fixes (pick one):
- Move `options` ____ the component (so it's created only once), or
- Move it ____ the effect itself, or
- Wrap it with `useMemo` / `useCallback` so its ____ stays stable between renders, or
- Depend on the specific **primitive** values inside it instead of the whole object.

**Case D: You need the previous state to compute the next state**

```
useEffect(() => {
    setCount( ____ => ____ + 1 )   // functional update form
}, [ ____ ])   // does count still need to be here?
```

Using the functional update form often lets you **remove** the state variable from the dependency array.

---

### Step 3: Checklist before you run it
- [ ] Did I pass a dependency array at all?
- [ ] Does every value in the array actually get *read* in the effect?
- [ ] Is the effect *writing* to anything in the array?
- [ ] Are any dependencies objects, arrays, or functions recreated each render?

If you share your actual effect, I can help you figure out which case it falls into.

**In your own words, what does the dependency array tell React about when your effect should run?**

</details>

### L3: 5/5

<details><summary>#1 pass · first token 7755ms · total 15719ms</summary>

# Why useEffect Loops Forever

An infinite loop happens when **the effect causes a re-render, and that re-render causes the effect to run again.** The usual culprits:

### 1. No dependency array

```jsx
useEffect(() => {
  setCount(count + 1);
}); // ❌ no array: runs after EVERY render
```

Without a second argument, the effect runs after every render. Setting state triggers a render, which runs the effect again.

### 2. Setting state that's also a dependency

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // ❌ changes count, which re-triggers the effect
```

If the effect updates a value it depends on, it feeds itself.

### 3. Dependencies that are "new" every render

React compares dependencies with `Object.is` (reference equality). Objects, arrays, and functions created inside the component body are brand-new on each render, so React treats them as changed even if their contents are identical.

## How to Fix It

| Situation | Fix |
|---|---|
| Run once on mount | Use an empty array: `[]` |
| Run when a specific value changes | List only primitives or stable values: `[userId]` |
| Updating state based on previous state | Use a functional update: `setCount(c => c + 1)` |
| Need an object or function as a dependency | Use `useMemo` / `useCallback`, or move it inside the effect |

## A Full Example

This component fetches users for a team, handles loading state, and cleans up to avoid setting state after unmount:

```jsx
import { useState, useEffect } from "react";

function UserList({ teamId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const params = { teamId, active: true };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchUsers(params).then((data) => {
      if (!cancelled) {
        setUsers(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) return <p>Loading...</p>;

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

**Heads up: there's exactly one bug hiding in this code, and it will cause the very infinite loop you're trying to avoid.** Read through it carefully, trace what happens after `setUsers` runs, and see if you can spot it and fix it.

**Tip:** Install `eslint-plugin-react-hooks` and enable the `exhaustive-deps` rule. It catches many of these problems as you type.

In your own words, what determines when a `useEffect` runs?

</details>

<details><summary>#2 pass · first token 6444ms · total 14337ms</summary>

# Stopping a useEffect Infinite Loop

An infinite loop almost always follows this cycle:

1. The component renders
2. The effect runs
3. The effect updates state
4. The state change triggers a re-render
5. React decides the effect should run again, and you're back at step 2

To break the loop, make sure step 5 doesn't happen unless something actually changed.

## The Three Usual Culprits

**1. No dependency array at all**
```jsx
useEffect(() => {
  setCount(count + 1);
}); // runs after EVERY render
```

**2. Updating a value that's also a dependency**
```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // the effect changes items, so the effect runs again
```

**3. Objects, arrays, or functions created during render**
React compares dependencies with `Object.is`, which checks *reference* equality, not contents. `{ a: 1 }` and `{ a: 1 }` are two different objects, so React treats them as "changed" every time.

## The Fixes

| Problem | Fix |
|---|---|
| No array | Add one: `[]` for "run once on mount," or list the real dependencies |
| State depends on itself | Use a functional update: `setItems(prev => [...prev, newItem])` and drop `items` from deps |
| Object or array dep | Depend on the primitive inside it (`user.id` instead of `user`), or wrap it in `useMemo` |
| Function dep | Move the function inside the effect, or wrap it in `useCallback` |

## A Complete Example

Here's a component that fetches a user, handles loading state, and cleans up stale requests. **It contains exactly one bug that will cause an infinite loop.** See if you can spot it before running it:

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = { id: userId };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) return <p>Loading...</p>;
  return <h1>{user.name}</h1>;
}
```

Tip: reread the "three usual culprits" above and check each one against this code. The ESLint rule `react-hooks/exhaustive-deps` is also worth enabling, since it flags many of these problems automatically.

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

<details><summary>#3 pass · first token 6844ms · total 18284ms</summary>

# Fixing an Infinite `useEffect` Loop

An infinite loop happens when **your effect updates something that causes the effect to run again**. The cycle looks like this:

```
render → effect runs → setState → re-render → effect runs → setState → ...
```

## The Three Usual Causes

### 1. No dependency array at all
```jsx
useEffect(() => {
  setCount(count + 1);
}); // ❌ no array means it runs after EVERY render
```

### 2. Setting state that's also a dependency
```jsx
useEffect(() => {
  setData([...data, newItem]);
}, [data]); // ❌ updating data changes data, which re-triggers the effect
```
**Fix:** use the functional updater and drop the dependency:
```jsx
useEffect(() => {
  setData(prev => [...prev, newItem]);
}, [newItem]);
```

### 3. Objects, arrays, or functions as dependencies
React compares dependencies with `Object.is`, which means **reference equality**. A new `{}` or `[]` or `() => {}` created during render is "different" every time, even if its contents are identical.
```jsx
const options = { sort: 'asc' };      // new object every render
useEffect(() => { ... }, [options]);  // ❌ runs every render
```
**Fix:** depend on primitives, or stabilize the reference with `useMemo` / `useCallback`.

## A Full Working Example

Here's a component that fetches a filtered user list, written to avoid all three problems:

```jsx
import { useState, useEffect, useMemo, useCallback } from 'react';

function UserList({ filters = {} }) {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Stabilize derived object so it doesn't change identity every render
  const query = useMemo(
    () => ({ ...filters, page }),
    [filters, page]
  );

  // Stabilize the function reference
  const fetchUsers = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(query).toString();
      const res = await fetch(`/api/users?${params}`, { signal });
      const data = await res.json();
      setUsers(data);  // safe: users is NOT a dependency below
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort(); // cleanup cancels stale requests
  }, [fetchUsers]);

  return (
    <div>
      {loading ? <p>Loading…</p> : users.map(u => <p key={u.id}>{u.name}</p>)}
      <button onClick={() => setPage(p => p + 1)}>Next page</button>
    </div>
  );
}
```

## ⚠️ Your Challenge

**There is exactly one bug in the code above that can still cause an infinite loop under a common usage pattern.** It's subtle. Everything *looks* memoized correctly. Trace the dependency chain from the top of the component down to the `useEffect` and think about what each value's identity is on every render.

## Debugging Tips for Your Own Code
- Add `console.log('effect ran')` inside the effect to confirm it's looping.
- For each dependency, ask: *"Is this a brand-new reference every render?"*
- Turn on the `react-hooks/exhaustive-deps` ESLint rule. It catches many of these mistakes.
- Note that in development, React StrictMode runs effects **twice** on mount on purpose. That's not a loop.

In your own words, what is `useEffect`'s dependency array actually telling React to do?

</details>

<details><summary>#4 pass · first token 7797ms · total 17182ms</summary>

# Stopping a useEffect Infinite Loop

An infinite loop almost always follows this cycle:

1. The component renders.
2. The effect runs and calls `setState`.
3. The state change triggers a re-render.
4. React checks the dependency array, decides the effect should run again, and you're back at step 2.

To break the loop, you need to control **when React decides the effect should re-run**.

## The Three Usual Culprits

**1. No dependency array at all**
```jsx
useEffect(() => {
  setCount(count + 1); // runs after EVERY render → loop
});
```

**2. Depending on the state you're setting**
```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // count changes → effect runs → count changes → ...
```

**3. Depending on something that's "new" every render**

React compares dependencies with `Object.is`. Objects, arrays, and functions created inside the component body are brand-new references on every render, so React always sees them as "changed."

## The Fixes

### Fix A: Use an empty array for "run once on mount"
```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(c => c + 1); // functional update: no need to read `count`
  }, 1000);
  return () => clearInterval(id);
}, []);
```
The functional updater (`c => c + 1`) lets you drop `count` from the dependencies entirely.

### Fix B: Depend only on the values that should trigger a re-run

Here's a full, realistic example: fetching a user whenever the `userId` prop changes.

```jsx
import { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const options = { userId, includePosts: true };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${options.userId}?posts=${options.includePosts}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true; // ignore stale responses if userId changes mid-fetch
    };
  }, [options]);

  if (loading) return <p>Loading…</p>;
  return <h1>{user.name}</h1>;
}
```

### Fix C: Stabilize objects and functions when you truly need them as dependencies
```jsx
const config = useMemo(() => ({ theme, locale }), [theme, locale]);
const handleData = useCallback(data => setItems(data), []);
```

## Your Challenge 🔍

The `UserProfile` example in Fix B contains **exactly one bug**. Under the right conditions, it will cause the very infinite loop we're trying to avoid. Everything else in this answer is correct. Can you find the bug, explain why it loops, and fix it?

Tips for tracking down loops in your own code:
- Add `console.log("effect ran")` inside the effect to see how often it fires.
- Turn on the `react-hooks/exhaustive-deps` ESLint rule. It flags missing dependencies and warns about dependencies that change on every render.

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

<details><summary>#5 pass · first token 6442ms · total 16134ms</summary>

## Why the loop happens

An infinite `useEffect` loop almost always follows this cycle:

1. The component renders.
2. The effect runs.
3. The effect updates state (`setSomething(...)`).
4. The state change triggers a re-render.
5. React decides the effect needs to run again, and you're back at step 2.

React decides whether to re-run an effect by looking at the **dependency array**, the second argument to `useEffect`:

| Dependency array | When the effect runs |
|---|---|
| *(omitted)* | After **every** render |
| `[]` | Once, after the first render |
| `[a, b]` | After the first render, then whenever `a` or `b` changes |

"Changes" is checked with `Object.is`, which compares by **identity**, not by contents.

## The common culprits

**1. No dependency array while setting state**

```jsx
useEffect(() => {
  setCount(count + 1); // runs after every render, forever
});
```

**2. A dependency that the effect itself changes**

```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // updating items re-triggers the effect
```

The fix is to use a functional update so you don't need `items` as a dependency:

```jsx
useEffect(() => {
  setItems(prev => [...prev, newItem]);
}, [newItem]);
```

**3. Non-primitive dependencies that are recreated each render**

Objects, arrays, and functions defined in the component body are brand-new references on every render, even if their contents are identical. To fix this, move them outside the component, move them inside the effect, or stabilize them with `useMemo` or `useCallback`.

## A full example

Here's a complete component that fetches a user profile. It handles cleanup so a slow, outdated response can't overwrite a newer one. **There is exactly one bug in this code that will cause an infinite loop.** See if you can find it before running it.

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const requestOptions = {
    headers: { Accept: 'application/json' },
  };

  useEffect(() => {
    let ignore = false;

    setError(null);

    fetch(`/api/users/${userId}`, requestOptions)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!ignore) setUser(data);
      })
      .catch(err => {
        if (!ignore) setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [userId, requestOptions]);

  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

export default UserProfile;
```

### Debugging tips while you hunt

- Add `console.log('effect ran')` at the top of the effect and watch how often it fires.
- Install the `eslint-plugin-react-hooks` package and enable its `exhaustive-deps` rule. It catches missing dependencies, and in many cases it will also warn about dependencies that change on every render.
- For each item in the dependency array, ask yourself: "Is this the *same reference* on every render unless something meaningful changed?"

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

### L4: 5/5

<details><summary>#1 pass · first token 1108ms · total 12598ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array** (or it has no dependency array at all). Each render triggers the effect, the effect triggers a re-render, and so on.

Here are the common causes and their fixes.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, which runs the effect again.
useEffect(() => {
  fetchData().then(setData);
});
```

```jsx
// ✅ Runs once, after the first render
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

### 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Ask whether this needs to be an effect at all. If it does, use a functional update and remove the dependency:

```jsx
// ✅ Doesn't depend on `count` anymore
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is` (reference equality). A new object, array, or function is created on every render, so it's "different" every time.

```jsx
// ❌ `options` is a new object each render
const options = { page: 1 };
useEffect(() => {
  fetchItems(options).then(setItems);
}, [options]);
```

**Fixes (pick one):**

```jsx
// ✅ a) Depend on primitive values instead
useEffect(() => {
  fetchItems({ page }).then(setItems);
}, [page]);

// ✅ b) Move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchItems(options).then(setItems);
}, []);

// ✅ c) Memoize it
const options = useMemo(() => ({ page }), [page]);
```

Same idea for functions:

```jsx
// ❌ loadData is recreated every render
const loadData = () => fetchItems(id).then(setItems);
useEffect(() => { loadData(); }, [loadData]);

// ✅ Wrap in useCallback (or just define it inside the effect)
const loadData = useCallback(() => fetchItems(id).then(setItems), [id]);
useEffect(() => { loadData(); }, [loadData]);
```

---

### 4. Props from a parent that change every render

If a parent passes `onChange={() => ...}` or `filters={{...}}` inline, your child's effect will re-run constantly. Fix it in the parent with `useCallback`/`useMemo`, or have the child depend only on the specific primitive values it needs.

---

### 5. Deriving state in an effect (you probably don't need the effect)

```jsx
// ❌ Unnecessary effect + extra render
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(first + ' ' + last);
}, [first, last]);

// ✅ Just compute it during render
const fullName = first + ' ' + last;
```

---

### Debugging tips

- **Enable the `react-hooks/exhaustive-deps` ESLint rule.** It flags missing or unstable dependencies.
- **Log what changed:**
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
  If a value *looks* the same but triggers the effect, it's a reference-equality issue (cause #3).
- **Don't silence the linter** by just omitting dependencies. That leads to stale-value bugs. Restructure the code instead.
- **In development, React 18 Strict Mode runs effects twice on mount.** That's intentional and isn't an infinite loop.

If you share your specific effect, I can point out exactly what's causing the loop.

</details>

<details><summary>#2 pass · first token 2520ms · total 13028ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array**, or a dependency changes on every render. Here are the common causes and fixes.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData triggers a render, which runs the effect again...
useEffect(() => {
  fetchData().then(setData);
});

// ✅ Runs once on mount
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

### 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);

// ✅ Use the functional updater and drop the dependency
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

Also ask whether you need an effect at all. If you're deriving state from other state, just compute it during render:

```jsx
// ❌
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(first + ' ' + last), [first, last]);

// ✅
const fullName = first + ' ' + last;
```

---

### 3. Objects, arrays, or functions as dependencies

These are recreated on every render, so React sees a "new" value each time (it compares with `Object.is`).

```jsx
// ❌ `options` is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchItems(options).then(setItems);
}, [options]);
```

**Fixes:**

```jsx
// ✅ Depend on primitive values instead
useEffect(() => {
  fetchItems({ page }).then(setItems);
}, [page]);

// ✅ Or memoize the object
const options = useMemo(() => ({ page }), [page]);

// ✅ Or move it inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchItems(options).then(setItems);
}, []);
```

Same for functions:

```jsx
// ❌ loadData is recreated every render
const loadData = () => fetchItems(id).then(setItems);
useEffect(() => { loadData(); }, [loadData]);

// ✅ Wrap with useCallback
const loadData = useCallback(() => fetchItems(id).then(setItems), [id]);
useEffect(() => { loadData(); }, [loadData]);

// ✅ Or define it inside the effect
useEffect(() => {
  const loadData = () => fetchItems(id).then(setItems);
  loadData();
}, [id]);
```

---

### 4. Props from a parent that change every render

If a parent passes `onChange={() => ...}` or `config={{...}}` inline, the child's effect will re-run each time. Fix it in the **parent** with `useCallback`/`useMemo`, or depend only on the specific primitive fields you need.

---

### 5. Setting state unconditionally

If the effect must depend on something it updates, add a guard:

```jsx
useEffect(() => {
  if (user && !profile) {
    loadProfile(user.id).then(setProfile);
  }
}, [user, profile]);
```

---

### Debugging tips

- **Enable the `react-hooks/exhaustive-deps` ESLint rule.** It catches most of these problems.
- **Log what changed:**
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
- **Don't silence the linter** by removing real dependencies. That trades the infinite loop for stale-data bugs.
- **React 18 StrictMode** runs effects twice on mount in development. That's expected behavior, not an infinite loop.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#3 pass · first token 1115ms · total 13199ms</summary>

An infinite `useEffect` loop almost always comes from the same cycle: **the effect updates state → the component re-renders → the effect runs again → it updates state again...** Here are the most common causes and how to fix each.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render
useEffect(() => {
  setCount(count + 1);
});
```

**Fix:** Add a dependency array. Use `[]` to run only once on mount:

```jsx
// ✅ Runs once on mount
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

### 2. Setting state that is also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use the functional updater so you don't need the state as a dependency, or reconsider whether this belongs in an effect at all:

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is`, which checks **reference equality**. A new object, array, or function is created on every render, so it is "different" every time:

```jsx
// ❌ options is a new object every render
const options = { page: 1 };

useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

**Fixes (pick one):**

**a) Depend on primitive values instead:**
```jsx
const page = 1;
useEffect(() => {
  fetchData({ page }).then(setData);
}, [page]);
```

**b) Move the object inside the effect:**
```jsx
useEffect(() => {
  const options = { page: 1 };
  fetchData(options).then(setData);
}, []);
```

**c) Memoize it:**
```jsx
const options = useMemo(() => ({ page }), [page]);
```

**d) For functions, use `useCallback`:**
```jsx
const loadData = useCallback(() => {
  fetchData(page).then(setData);
}, [page]);

useEffect(() => {
  loadData();
}, [loadData]);
```

---

### 4. Props that are recreated by the parent

If a parent passes an inline object or function, it is new on every parent render:

```jsx
// Parent
<Child onLoad={() => console.log('loaded')} config={{ id: 5 }} />
```

**Fix:** Memoize in the parent with `useCallback` or `useMemo`, or have the child depend on primitive fields like `config.id`.

---

### 5. Fetching data that sets state with a new reference

```jsx
// ❌ If `filters` is derived from data, this can loop
useEffect(() => {
  fetch(url).then(r => r.json()).then(setData);
}, [data]);
```

**Fix:** Depend on the *inputs* to the fetch (such as `url` or an ID), never on the *result*.

---

### Debugging tips

- **Read the ESLint warning.** The `react-hooks/exhaustive-deps` rule is very helpful. Don't silence it. Restructure the code instead.
- **Find what's changing.** Log the dependencies to see which one differs each render:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
- **Ask whether you need an effect at all.** If you're computing a value from props or state, just compute it during render (or with `useMemo`). Effects are for syncing with *external* systems. See React's guide: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

---

### Quick checklist

| Symptom | Fix |
|---|---|
| No dependency array | Add `[]` or the correct deps |
| Effect sets a state it depends on | Use the functional updater `setX(prev => ...)` |
| Object/array dependency | Use primitives, move it inside the effect, or `useMemo` |
| Function dependency | Move it inside the effect or `useCallback` |
| Depending on fetched data | Depend on the fetch inputs instead |

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#4 pass · first token 1261ms · total 12572ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array**, or a dependency changes on every render. Here are the common causes and fixes.

---

### 1. No dependency array at all

```jsx
// ❌ Runs after EVERY render. setData causes a render, which runs the effect again...
useEffect(() => {
  fetchData().then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run once on mount:

```jsx
// ✅ Runs once after the first render
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

### 2. Setting state that's also a dependency

```jsx
// ❌ count changes, effect runs, count changes, effect runs...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use the functional updater so you don't need the state as a dependency, or rethink whether this belongs in an effect at all:

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is` (reference equality). A new object, array, or function is created on every render, so the effect sees a "change" every time.

```jsx
// ❌ `options` is a new object every render
const options = { userId: id };

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**Fixes (pick one):**

**a) Depend on primitive values instead:**
```jsx
useEffect(() => {
  fetchUser({ userId: id }).then(setUser);
}, [id]); // ✅ id is a string/number
```

**b) Move the object inside the effect:**
```jsx
useEffect(() => {
  const options = { userId: id };
  fetchUser(options).then(setUser);
}, [id]);
```

**c) Memoize it:**
```jsx
const options = useMemo(() => ({ userId: id }), [id]);
```

**For functions**, move them inside the effect or wrap them in `useCallback`:
```jsx
// ❌ loadData is recreated every render
const loadData = () => fetch(`/api/${id}`);
useEffect(() => { loadData(); }, [loadData]);

// ✅ Option 1: define it inside the effect
useEffect(() => {
  const loadData = () => fetch(`/api/${id}`);
  loadData();
}, [id]);

// ✅ Option 2: useCallback
const loadData = useCallback(() => fetch(`/api/${id}`), [id]);
useEffect(() => { loadData(); }, [loadData]);
```

---

### 4. Props from a parent that change every render

If a parent passes `items={[...]}` or `onChange={() => ...}` inline, the child receives a new reference each render. Fix it in the **parent** with `useMemo` or `useCallback`, or depend on something stable (like `items.length` or an ID) in the child.

---

### Debugging tips

- **Log inside the effect** to see how often it fires.
- **Check which dependency changed.** Log each one, or temporarily remove them one at a time.
- **Keep the ESLint rule `react-hooks/exhaustive-deps` on.** Don't silence it to "fix" a loop. That usually hides a stale-data bug instead.
- **Ask whether you need an effect at all.** If you're computing a value from props or state, just compute it during render (or with `useMemo`). See React's guide [*You Might Not Need an Effect*](https://react.dev/learn/you-might-not-need-an-effect).

```jsx
// ❌ Unnecessary effect + extra render
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(first + ' ' + last);
}, [first, last]);

// ✅ Just derive it
const fullName = first + ' ' + last;
```

---

If you paste your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#5 pass · first token 1123ms · total 12573ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array** (or it has no dependency array). Each render triggers the effect, the effect triggers a re-render, and so on. Here are the common causes and fixes.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. If it sets state, it loops forever.
useEffect(() => {
  fetchData().then(setData);
});

// ✅ Runs once, after the first render
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

### 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Ask whether this needs to be an effect at all. If it does, use a functional update and remove the dependency:

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // no longer depends on count
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is` (reference equality). A new object, array, or function is created on every render, so it's "different" every time:

```jsx
// ❌ options is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

**Fixes (pick one):**

```jsx
// a) Depend on primitives instead
const page = 1;
useEffect(() => {
  fetchData({ page }).then(setData);
}, [page]);

// b) Move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchData(options).then(setData);
}, []);

// c) Memoize it
const options = useMemo(() => ({ page }), [page]);
```

Same idea for functions:

```jsx
// ❌ new function every render
const load = () => fetchData(id).then(setData);
useEffect(() => { load(); }, [load]);

// ✅ memoize with useCallback (or define it inside the effect)
const load = useCallback(() => fetchData(id).then(setData), [id]);
useEffect(() => { load(); }, [load]);
```

---

### 4. Props from a parent that change every render

If a parent passes `options={{ ... }}` or `onChange={() => ...}` inline, the child gets a new reference every render. Fix it in the **parent** with `useMemo`/`useCallback`, or have the child depend on specific primitive fields (`props.options.page`).

---

### 5. Fetched data stored and depended on

```jsx
// ❌ data changes → refetch → data changes → ...
useEffect(() => {
  fetchData().then(setData);
}, [data]);
```

Depend on what should *trigger* the fetch (an ID, a query string), not on the result.

---

### 6. You might not need an effect

If you're computing a value from props or state, just compute it during render:

```jsx
// ❌
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(first + ' ' + last);
}, [first, last]);

// ✅
const fullName = first + ' ' + last;
```

---

### Debugging tips

- **Don't silence the linter.** Turn on `eslint-plugin-react-hooks` (`exhaustive-deps`). It'll flag missing deps. If adding a dep causes a loop, that's a sign to restructure (move it inside, memoize, or use a functional update), not to remove it.
- **Find the culprit:** log the dependencies to see which one changes every render:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
- **React 18 Strict Mode** runs effects *twice* on mount in development. That's not an infinite loop. It's intentional, and it doesn't happen in production.

If you share your actual `useEffect` code, I can point out exactly what's causing the loop.

</details>

### Demo answer graded against each L1 reply above

- #1: correct 0.88: The student correctly explains that the dependency array controls re-running: the effect runs again only when a listed value changes, and an empty array means it runs once after mount, which answers the core question at this level.
- #2: correct 0.90: The student correctly explains that React re-runs an effect only when a value in its dependency array changes, and that an empty array means it runs once after mount, which is the core mechanism at this level.
- #3: correct 0.80: The student correctly explains that the dependency array controls when the effect re-runs (only when listed values change) and that an empty array means it runs once after mount, which is the core mechanism at the remember/understand level.
- #4: correct 0.85: The student correctly explains that the dependency array controls re-runs, with the effect re-running only when a listed value changes and an empty array meaning it runs once after mount, which answers the question at the required level.
- #5: correct 0.85: The student accurately explains that the dependency array controls when the effect re-runs, firing only when a listed value changes, with an empty array meaning it runs once after mount, which is the core mechanism at this level.

## Grading

| case | level | expected | got | confidence | new_level | time | rationale |
|---|---|---|---|---|---|---|---|
| demo correctAnswer | L1 | correct | correct | 0.93 | L4 | 1736ms | The student correctly explains that the dependency array tells React to re-run the effect only when one of the listed values changes, and that an empty array means it runs once after mount, which is sufficient at this level. |
| demo lazyAnswer at L3 | L3 | lazy | lazy | 0.97 | L2 | 1903ms | The student asked for code instead of explaining what the dependency array tells React, so they did not engage with the question. |
| partial | L1 | partial | partial | 0.85 | L1 | 1735ms | The student correctly places the dependency array as the second argument and senses that it controls the effect, but does not explain that it tells React to re-run the effect only when the listed values change. |
| incorrect | L1 | incorrect | incorrect | 0.93 | L1 | 1735ms | The student thinks the dependency array restricts which state the effect may update, when it actually lists the values React watches to decide when to re-run the effect after a render. |
| not_an_answer | L1 | not_an_answer | not_an_answer | 0.97 | L1 | 2434ms | The student asked an unrelated CSS question instead of explaining what the dependency array tells React. |

## Classify (LLM fallback)

| prompt | expected | got | method | confidence | time |
|---|---|---|---|---|---|
| How can I share the current theme with deeply nested parts of my app without handing it down manually at every level? | Context API | Context API | llm | 0.95 | 1283ms |
| Why does my list re-render every time its parent does, even when its data did not change? | Performance & Memoization | Performance & Memoization | llm | 0.85 | 1431ms |
| write a haiku about autumn leaves | null | null | none | 0.00 | 1543ms |

## Parse (`fixtures/demo-syllabus.md`)

### text: CSE 134R — React Fundamentals (9868ms)

- **Foundations**
  - `n1` JSX & Components · L3 minor · code · [jsx, react.createelement, function component, component tree, fragment] · deps []  
    Explains what JSX compiles to (React.createElement / jsx calls) and decomposes a UI mockup into reusable components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback props, lifting state up] · deps [n1]  
    Passes data and callbacks through props, uses the children prop, and explains one-way data flow
  - `n3` State with useState · L4 major · refresh · [usestate, setstate, functional update, re-render, stale state, batching] · deps [n2]  
    Uses useState correctly, including functional updates, and explains why state updates are asynchronous
- **Effects & Data**
  - `n4` React useEffect · L4 major · zap · [useeffect, dependency array, cleanup function, infinite loop, too many re-renders, side effects] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array, and writes correct cleanup functions
  - `n5` Data Fetching · L3 minor · download · [fetch, loading state, error state, race condition, abortcontroller, async useeffect] · deps [n4]  
    Fetches data inside an effect with loading and error states and prevents race conditions using cleanup or AbortController
  - `n6` Custom Hooks · L3 minor · hook · [custom hook, rules of hooks, use prefix, hooks called conditionally, reusable logic] · deps [n4]  
    Extracts reusable stateful logic into a custom hook and explains the rules of hooks
- **Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, provider, prop drilling, global state] · deps [n3]  
    Uses createContext and useContext to share state and justifies when context beats prop drilling
  - `n8` Performance & Memoization · L4 major · cpu · [react.memo, usememo, usecallback, unnecessary re-renders, referential equality, profiler] · deps [n6, n7]  
    Diagnoses unnecessary re-renders and applies React.memo, useMemo, and useCallback appropriately, explaining when memoization helps

### pdf: CSE 134R - React Fundamentals (9946ms)

- **Module 1 - Foundations**
  - `n1` JSX & Components · L3 major · code · [jsx, react.createelement, function component, component tree, fragment, adjacent jsx elements] · deps []  
    Explains what JSX compiles to (React.createElement/jsx calls) and decomposes a UI mockup into reusable components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback props, prop drilling, destructuring props] · deps [n1]  
    Passes data and callbacks through props, uses the children prop, and explains one-way data flow
  - `n3` State with useState · L4 major · database · [usestate, setstate, functional update, stale state, re-render, state not updating] · deps [n2]  
    Uses useState correctly, including functional updates, and explains why state updates are asynchronous
- **Module 2 - Effects & Data**
  - `n4` React useEffect · L4 major · refresh · [useeffect, dependency array, cleanup function, infinite loop, too many re-renders, side effect] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array, and writes cleanup functions
  - `n5` Data Fetching · L3 minor · download · [fetch, loading state, error state, race condition, abortcontroller, async useeffect] · deps [n4]  
    Fetches data in an effect with loading and error states and prevents race conditions using cleanup or AbortController
  - `n6` Custom Hooks · L4 major · hook · [custom hook, rules of hooks, use prefix, invalid hook call, hooks called conditionally, reusable logic] · deps [n4]  
    Extracts reusable stateful logic into a custom hook and explains the rules of hooks
- **Module 3 - Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, context provider, prop drilling, global state] · deps [n3]  
    Uses createContext and useContext to share state and explains when context beats prop drilling
  - `n8` Performance & Memoization · L4 major · zap · [react.memo, usememo, usecallback, unnecessary re-renders, referential equality, react profiler] · deps [n6, n7]  
    Applies React.memo, useMemo, and useCallback to eliminate unnecessary re-renders and justifies when memoization is worthwhile

## 3-turn sandbox exchange

**Student (L1):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 1129ms):**

Infinite loops with `useEffect` usually come down to one thing: understanding exactly *when* React decides to run your effect.

Here's a hint: picture the cycle that happens when your effect updates state. What does a state update cause React to do next, and once that happens, what does React check to decide whether your effect should run again?

If you trace that cycle step by step, you'll likely spot where your loop never gets a chance to stop.

In your own words, how does React decide when a `useEffect` should run?

**Student (graded correct 0.85 → L4: The student accurately explains that React re-runs an effect only when a listed dependency changes, and that an empty array means it runs once after mount, which is the core mechanism at this level.):**

The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.

**Claude (first token 1073ms):**

Exactly right. The dependency array tells React which values to compare after each render, and the effect re-runs only when one of them has changed. Infinite loops happen when something in that cycle *always* looks changed, or when there's no array at all.

## The loop

1. Component renders
2. Effect runs and calls `setState`
3. State update triggers a re-render
4. React checks the dependencies: if anything "changed" (or there's no array), the effect runs again, and you're back to step 2

## Common causes and fixes

### 1. No dependency array

```jsx
// ❌ Runs after EVERY render, so it sets state, re-renders, and runs again forever
useEffect(() => {
  setCount(count + 1);
});
```

**Fix:** Add an array listing what the effect actually depends on.

```jsx
// ✅ Runs once after mount
useEffect(() => {
  fetchData().then(setData);
}, []);
```

### 2. Updating a value that's also a dependency

```jsx
// ❌ count changes, so the effect runs again and changes count...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update so you don't need the value as a dependency. Better yet, ask whether this belongs in an effect at all. Usually it should happen in an event handler.

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

### 3. Objects, arrays, or functions created during render

React compares dependencies with `Object.is`, which checks reference equality. A new object or function is created on every render, so it's always "different."

```jsx
// ❌ options is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchItems(options).then(setItems);
}, [options]);
```

**Fixes (pick one):**

```jsx
// ✅ Depend on primitives instead
useEffect(() => {
  fetchItems({ page }).then(setItems);
}, [page]);

// ✅ Move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchItems(options).then(setItems);
}, []);

// ✅ Memoize it
const options = useMemo(() => ({ page }), [page]);

// ✅ For functions, use useCallback (or define them inside the effect)
const load = useCallback(() => fetchItems(page), [page]);
useEffect(() => { load().then(setItems); }, [load]);
```

### 4. Setting state to a new object/array with the same contents

```jsx
// ❌ If data is a dependency, a fresh array each time loops forever
setData([...result]);
```

**Fix:** Depend on the inputs (like an ID or query string), not on the data the effect produces.

## Checklist when you hit a loop

- Is there a dependency array at all?
- Does the effect set a state value that's also in its dependencies?
- Are any dependencies objects, arrays, or functions created during render?
- Does this logic need to be an effect? Derived values can just be computed during render, and user-triggered logic belongs in event handlers.

Also, keep the `eslint-plugin-react-hooks` rule `exhaustive-deps` turned on. It catches missing dependencies, and if it pushes you to add something that causes a loop, that's a signal to restructure using one of the fixes above rather than to silence the warning.

If you share the specific effect that's looping, I can point to exactly which of these is happening.

**Student, new chat (L4, no block):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 1086ms):**

An infinite `useEffect` loop happens when the effect **updates something that causes it to run again**. Usually that's a state update combined with a missing or unstable dependency. Here are the common causes and their fixes.

---

## 1. No dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, so it loops forever
useEffect(() => {
  fetchData().then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run once on mount:

```jsx
// ✅
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes, effect runs, count changes, ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update and remove the dependency, or rethink whether this belongs in an effect at all:

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

---

## 3. Objects, arrays, or functions as dependencies

React compares dependencies by **reference**. Objects, arrays, and functions created during render are new on every render, so the effect always re-runs.

```jsx
// ❌ options is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

**Fixes (pick one):**

```jsx
// ✅ a) Depend on primitive values instead
useEffect(() => {
  fetchData({ page }).then(setData);
}, [page]);

// ✅ b) Move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchData(options).then(setData);
}, []);

// ✅ c) Memoize it
const options = useMemo(() => ({ page }), [page]);
```

The same applies to functions:

```jsx
// ❌ loadData is recreated every render
const loadData = () => fetchData(id).then(setData);
useEffect(() => { loadData(); }, [loadData]);

// ✅ wrap it in useCallback
const loadData = useCallback(() => fetchData(id).then(setData), [id]);
useEffect(() => { loadData(); }, [loadData]);

// ✅ or simply define it inside the effect
useEffect(() => {
  const loadData = () => fetchData(id).then(setData);
  loadData();
}, [id]);
```

---

## 4. Unstable props from a parent

If a parent passes `onChange={() => ...}` or `config={{...}}`, the child receives a new reference on every render. Memoize the value in the parent with `useCallback` or `useMemo`.

---

## 5. Guard against unnecessary updates

Sometimes you only need to update state when the value actually changes:

```jsx
useEffect(() => {
  if (value !== derived) setDerived(value);
}, [value, derived]);
```

Even better, **you may not need the effect at all**. If you're computing state from props or other state, calculate it during render instead:

```jsx
// ❌
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(`${first} ${last}`), [first, last]);

// ✅
const fullName = `${first} ${last}`;
```

---

## Debugging tips

- **Enable the ESLint rule** `react-hooks/exhaustive-deps`. It flags missing and unstable dependencies.
- **Log inside the effect** to see which dependency changes:
  ```jsx
  useEffect(() => { console.log('effect ran', { a, b }); }, [a, b]);
  ```
- Note that **React 18+ Strict Mode** intentionally runs effects twice in development. That's a deliberate double run, not an infinite loop.

If you share your specific `useEffect` code, I can pinpoint the exact cause.
