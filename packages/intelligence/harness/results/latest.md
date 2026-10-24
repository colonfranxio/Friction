# Harness results

Run: 2026-10-24T19:45:10.430Z · models: chat=claude-opus-5-5 grade=claude-opus-5-5 classify=claude-haiku-5-5 parse=claude-opus-5-5

## Summary

- L1: **5/5** (CP2 gate ≥4)
- L2: **5/5** (CP2 gate ≥4)
- L3: **5/5** (CP3 gate ≥4)
- L4: **5/5** (CP2 gate ≥4)
- Demo answer vs the real L1 quizzes: **5/5** correct
- Grading: **11/11** match
- Classify fallback: **3/3**
- Parse text: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 14334ms)
- Parse pdf: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 11266ms)
- 3-turn exchange: **pass** (automatic checks; read the transcript for naturalness)

## Level compliance (`DEMO_PROMPTS.question`)

### L1: 5/5

<details><summary>#1 pass · first token 1366ms · total 4130ms</summary>

Infinite `useEffect` loops usually come from a cycle, and spotting it is the key to fixing it.

**A hint:** Think about what happens *after* your effect runs. If the effect changes something, React re-renders. Then ask yourself: what does React check after that render to decide whether to run the effect again? Look closely at the second argument you pass to `useEffect`, or notice if it's missing. If something in it gets a new value on every render, even one that *looks* the same, like a freshly created object or array, React may treat it as "changed" each time.

Try tracing one full cycle in your component: render → effect runs → state updates → render → ?

In your own words, what decides *when* a `useEffect` runs?

</details>

<details><summary>#2 pass · first token 1254ms · total 3415ms</summary>

Infinite loops with `useEffect` usually come down to *when* React decides to run the effect again.

**Hint:** Look at what your effect *does* (does it update state?) and what you've told React to *watch* (is there a dependency array, and what's in it?). Then trace what happens on the next render: does anything you're watching end up "changed" again?

It's worth noticing that objects, arrays, and functions created inside your component are brand-new values on every render, even if they look identical.

In your own words, what decides whether React re-runs a `useEffect` after a render?

</details>

<details><summary>#3 pass · first token 1289ms · total 4108ms</summary>

Infinite loops with `useEffect` are a common snag, and figuring out *why* yours loops will help you fix this one and avoid the next.

Look at your effect and ask yourself two things:

1. **What does the effect change?** For example, does it call a state setter like `setSomething(...)`?
2. **What tells React when to run the effect again?** Look at what's (or isn't) after the callback function.

**Hint:** Think about the cycle. A state update causes a re-render, and React then decides whether to re-run your effect based on that second argument. If the effect itself triggers the condition that makes it run again, the cycle never ends. Also consider that objects, arrays, and functions created during render are brand-new each time, even if they look identical.

In your own words, what decides when a `useEffect` runs?

</details>

<details><summary>#4 pass · first token 1109ms · total 4086ms</summary>

Infinite loops with `useEffect` almost always come down to one thing: something about the effect keeps telling React "run me again." Let's work out what that something is in your case.

**A hint:** Think about the chain of events. Your effect runs, and inside it you probably do something that causes the component to re-render, like updating state. After that re-render, what does React check to decide whether to run the effect *again*? If that check always says "yes, things changed," you get a loop.

It's also worth looking at whether you passed a second argument to `useEffect` at all, and if you did, what's in it. Some values, such as objects, arrays, or functions created during render, can look "new" to React on every single render even when their contents haven't changed.

In your own words, what decides *when* a `useEffect` runs?

</details>

<details><summary>#5 pass · first token 1288ms · total 5022ms</summary>

Infinite loops with `useEffect` almost always come down to one thing: something inside the effect causes a re-render, and something about that re-render tells React to run the effect again. Before jumping to a fix, it helps to pin down *why* your particular effect keeps firing.

**Hint:** Look closely at the second argument you pass to `useEffect`, or notice if you didn't pass one at all. Then look at what your effect *does*. Does it update state? If so, think about what happens on the very next render and whether React sees a reason to run your effect again.

It's also worth checking whether anything in that second argument is an object, array, or function created fresh during each render. React compares those by reference, not by contents.

If you share the effect you're working with, we can trace through one render cycle together and spot exactly where the loop closes.

In your own words, how does React decide when to re-run a `useEffect`?

</details>

### L2: 5/5

<details><summary>#1 pass · first token 2022ms · total 11490ms</summary>

An infinite `useEffect` loop almost always comes from the same cycle:

1. The component **renders**
2. The effect **runs** after the render
3. The effect **updates state** (or something it depends on)
4. The state change causes a **re-render**, and the cycle repeats

To break the loop, you need to control **when** the effect is allowed to run again. That's the job of the **dependency array**, the second argument to `useEffect`.

### Step 1: Diagnose which case you're in

| What your effect looks like | What happens |
|---|---|
| No dependency array at all | Runs after **every** render |
| Dependency array includes the state it sets | Runs every time it changes that state |
| Dependency array includes an object, array, or function created during render | That value is "new" on every render, so the effect runs every time |
| Empty dependency array | Runs only after the **first** render |

### Step 2: Fill in the skeleton

Here's the shape of a safe effect. Fill in the blanks for your situation:

```
useEffect( () => {
    // do the side effect (fetch, subscribe, etc.)
    // update state ONLY IF ____ (a condition that eventually stops being true)
}, [ ____ ] )   // <- list only the values the effect actually READS from outside
```

Questions to guide the blanks:
- **Second blank:** Which props or state does the effect *read*? Those go in the array. Does it need to re-run when they change, or only once on mount? If only once, what goes in the array?
- **First blank:** If the effect must set a state value that's also in the array, what condition keeps it from setting that state again with the same result?

### Step 3: Watch for "secretly new" dependencies

If you have something like this:

```
const options = { ____ }   // created fresh every render
useEffect( ..., [options] )
```

the array sees a brand-new `options` each render, so the effect always re-runs. Your options:
- Move the object or function **inside** the effect
- Move it **outside** the component if it doesn't depend on props or state
- Memoize it with `____` (for objects or arrays) or `____` (for functions) so it keeps the same identity between renders

### Step 4: Set state from the previous value

If the effect only reads a state variable so it can update it (for example, adding to a count), use the **functional updater** form of the setter: `setX( prev => ____ )`. Then you can leave that state out of the dependency array.

Try applying this checklist to your effect. If you paste your version with the blanks filled in, I can help you check it.

In your own words, what does the dependency array tell React about when your effect should run?

</details>

<details><summary>#2 pass · first token 1163ms · total 9241ms</summary>

An infinite `useEffect` loop almost always follows this cycle:

1. The component renders.
2. The effect runs **after** the render.
3. The effect updates state (e.g., `setSomething(...)`).
4. The state change triggers a **re-render**.
5. React checks whether the effect should run again, and if nothing stops it, you're back to step 2.

The **dependency array** (the second argument to `useEffect`) is what breaks the cycle. It tells React to re-run the effect only when one of these values has changed since the last render.

### The three cases

| What you pass as the 2nd argument | When the effect runs |
|---|---|
| nothing at all | after **every** render (most common cause of loops) |
| an empty array | only **once**, after the first render |
| an array with values | only when one of **those values** changes |

### Outline with blanks

```
useEffect(
  () => {
    // do some work (fetch data, compute something, etc.)
    // possibly call a state setter: set____( ____ )
  },
  [ ____ ]   // ← which values should cause this effect to re-run?
)
```

For each blank, ask yourself:

- **What does the effect read from outside itself?** Props, state, or variables it uses should usually go in the array.
- **Is the state you're setting also in the array?** If the effect sets `X` and `X` is a dependency, every run changes `X`, which re-runs the effect. That's a loop.
- **Should this run only once (e.g., an initial fetch)?** Then the array might be ____.

### Two sneakier causes

- **Objects, arrays, or functions created during render.** If you write something like `const options = { ... }` inside the component and put `options` in the array, it's a *new* object on every render. React compares by reference, so it always looks "changed." You can fix this by moving it ____ the component, or by memoizing it with a hook like `use____`.
- **Setting state to a new value every time.** If the effect does `setItems([...something])` unconditionally, each run produces a new array. Consider adding a ____ (a condition) so you only set state when the value actually differs.

### Debugging checklist

1. Is there a dependency array at all?
2. Does the effect set a state value that's also listed as a dependency?
3. Are any dependencies objects, arrays, or functions recreated each render?

If you share your effect, I can help you work out which blank applies to your case.

In your own words, what is the dependency array actually telling React to do?

</details>

<details><summary>#3 pass · first token 1940ms · total 9639ms</summary>

An infinite loop with `useEffect` almost always comes from this cycle:

1. The component **renders**
2. The effect **runs** after the render
3. The effect **updates state**
4. The state change triggers a **re-render**
5. React checks whether the effect should run again, and if nothing stops it, it goes back to step 2

The **dependency array** is what decides whether the effect runs again at step 5.

### The three common culprits

**1. No dependency array at all**

```
useEffect(() => {
  ____ // something that sets state
})   // ← what's missing here?
```

Without the second argument, React runs the effect after **every** render. Ask yourself: *what should go after the callback, and what should be inside it?*

**2. Depending on the same state you're setting**

```
useEffect(() => {
  setCount(____ + 1)
}, [____])
```

If the effect updates a value **and** lists that value as a dependency, each update triggers the effect again. Ask yourself: *does this effect really need to re-run when that value changes, or only when something else changes?*

**3. Objects, arrays, or functions created during render**

```
const options = { page: 1 }   // created fresh on every render

useEffect(() => {
  fetchData(options)
}, [options])
```

React compares dependencies by **reference**. A new object on every render counts as "changed" every time, even if its contents are identical. Some ways to fix it:
- Move the object/function **____** the component, or **____** the effect
- Depend on the **primitive values** inside it (e.g., `____.page`) instead of the whole object
- Use a hook that keeps the reference stable between renders (one for values, one for functions: `use____` and `use____`)

### A debugging checklist

- [ ] Does my effect set state? Which state?
- [ ] Is there a dependency array? What's in it?
- [ ] Is any dependency something the effect itself changes?
- [ ] Is any dependency a non-primitive created during render?
- [ ] Should this run once on mount (empty array `[____]`), or when specific values change?

Try putting a `console.log` at the top of your effect and inside your component body. Watching which one fires repeatedly will show you where the cycle is.

What does the dependency array tell React about when to run an effect?

</details>

<details><summary>#4 pass · first token 1215ms · total 9649ms</summary>

An infinite useEffect loop almost always follows the same chain:

1. Your effect runs.
2. Inside it, you **update state** (e.g., `setSomething(...)`).
3. The state change causes a **re-render**.
4. After the re-render, React checks whether the effect should run again. If nothing tells it to skip, it runs again, and you're back at step 1.

So the fix comes down to **telling React exactly when the effect should re-run.** That's the job of the **dependency array**, the second argument to `useEffect`.

### The Three Dependency Array Cases

| What you pass | When the effect runs |
|---|---|
| Nothing (no second argument) | After **every** render |
| An **empty** array | ____ (fill in) |
| An array **with values** | Only when ____ changes |

### A Typical Buggy Pattern

```
useEffect(() => {
  fetch data
  then setData(result)
})   ← what's missing here?
```

The effect sets state, setting state re-renders, and with no second argument it runs again forever.

### Fixed Version

```
useEffect(() => {
  fetch data
  then setData(result)
}, ____ )   ← what should go here if you only want this once, on mount?
```

And if the fetch depends on something like a `userId` prop:

```
useEffect(() => {
  fetch data for ____
  then setData(result)
}, [ ____ ])   ← which value should trigger a re-fetch?
```

### Other Common Traps

- **Listing the state you're setting as a dependency.** If the effect sets `data` and `data` is in the array, you've rebuilt the loop. Ask yourself: does this effect actually need to *read* that value?
- **Objects, arrays, or functions created during render.** React compares dependencies by *reference*, and a new `{}` or `() => {}` is "different" on every render even if its contents look identical. Possible fixes: move the value ____ the component, or create it ____ the effect, or memoize it.
- **Unconditional state updates.** If an effect must set state based on a dependency, consider adding a check like `if (____ !== ____)` before setting.

### Debugging Checklist

1. Does the effect call a state setter? → ____
2. Is there a dependency array at all? → ____
3. Does any dependency change *because of* what the effect does? → ____
4. Are any dependencies objects/functions recreated each render? → ____

In your own words, what is the dependency array telling React to do?

</details>

<details><summary>#5 pass · first token 1632ms · total 9070ms</summary>

An infinite loop usually comes from this cycle:

1. The component **renders**
2. `useEffect` **runs** after the render
3. The effect **updates state**
4. The state change triggers a **re-render**, and the cycle repeats

The fix is to tell React *when* the effect should re-run, using the dependency array.

### Step 1: Diagnose which case you're in

| Symptom | Likely cause |
|---|---|
| No second argument passed to `useEffect` | Effect runs after **every** render |
| The state you set is also in the dependency array | Effect changes its own trigger |
| An object, array, or function defined in the component body is in the array | A **new reference** is created each render, so React sees it as "changed" |

### Step 2: Fill in the outline

```
useEffect( () => {
    // do the work (fetch, subscribe, etc.)
    // update state with the result
}, [ ____ ] )
```

Ask yourself:
- Should this run **only once on mount**? Then the array should contain ____.
- Should it re-run when a specific value changes? Then list **only** ____ (the values the effect *reads*, not the ones it *writes*).

### Step 3: If a dependency is an object, array, or function

```
// Problem: this is recreated on every render
const options = { ... }

// Options to fix:
//   a) Move it ____ the component (or inside the effect)
//   b) Wrap it with ____ (for objects/arrays) or ____ (for functions)
//   c) Depend on a ____ value inside it instead of the whole thing
```

### Step 4: If you must update state based on previous state

```
setCount( ____ => ____ + 1 )
```

Using the updater form means the effect doesn't need to *read* `count`, so `count` doesn't need to be a dependency.

### Quick checklist
- [ ] Is there a dependency array at all?
- [ ] Am I setting a value that is also listed as a dependency?
- [ ] Are any dependencies recreated on every render?

If you share your effect, I can help you work out which case it is.

In your own words, what determines when a `useEffect` runs again?

</details>

### L3: 5/5

<details><summary>#1 pass · first token 6409ms · total 16340ms</summary>

An infinite `useEffect` loop almost always follows the same pattern: **the effect updates something, that update triggers a re-render, and the re-render makes React think the effect needs to run again.**

## The three usual causes

### 1. No dependency array
```jsx
useEffect(() => {
  setCount(c => c + 1);
}); // ❌ no array: runs after EVERY render
```
Without a second argument, the effect runs after every render. If it sets state, that causes a render, which runs the effect again.

**Fix:** add a dependency array.
```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // ✅ runs once after mount
```

### 2. Depending on the state you're setting
```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // ❌ count changes → effect runs → count changes → ...
```
**Fix:** use a functional update so you don't need `count` as a dependency.
```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // ✅
```

### 3. Objects, arrays, or functions created during render
React compares dependencies with `Object.is`, so a new `{}` or `() => {}` is "different" on every render, even if its contents are identical.
```jsx
const options = { userId };           // new object every render
useEffect(() => { /* ... */ }, [options]); // ❌ always "changed"
```
**Fixes:**
```jsx
// Depend on the primitive instead
useEffect(() => { /* ... */ }, [userId]); // ✅

// Or memoize the object
const options = useMemo(() => ({ userId }), [userId]);
useEffect(() => { /* ... */ }, [options]); // ✅

// Same idea for functions
const load = useCallback(() => { /* ... */ }, [userId]);
useEffect(() => { load(); }, [load]); // ✅
```

## A complete data-fetching example

Here's a typical "fetch on prop change" component. **I've hidden exactly one bug in it. See if you can find it before running it:**

```jsx
import { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/users/${userId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch(err => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true; // ignore stale responses if userId changes
    };
  }, [userId, user]);

  if (error) return <p>Something went wrong: {error.message}</p>;
  if (!user) return <p>Loading…</p>;
  return <h1>{user.name}</h1>;
}
```

## Debugging tips
- **Turn on the `react-hooks/exhaustive-deps` ESLint rule.** It flags missing deps, and if it pushes you toward adding something that causes a loop, that's a sign to restructure (functional updates, `useMemo`, moving logic inside the effect).
- **Log inside the effect** (`console.log("effect ran", deps)`) to see which value keeps changing.
- **In development, React 18+ Strict Mode runs effects twice on mount.** That's intentional and isn't an infinite loop.

In your own words, what is a dependency array telling React about when an effect should run?

</details>

<details><summary>#2 pass · first token 5677ms · total 15089ms</summary>

## Why it loops

An infinite `useEffect` loop almost always follows this cycle:

1. The component renders.
2. The effect runs and **updates state**.
3. The state change triggers a **re-render**.
4. React checks the dependency array, decides something "changed," and **runs the effect again**.
5. Back to step 2.

The fix is to make sure the effect only re-runs when something has *actually* changed.

## The three usual culprits

**1. No dependency array at all**

```jsx
useEffect(() => {
  setCount(count + 1);
}); // ❌ runs after EVERY render
```

Without the second argument, the effect runs after every render. Add an array:

```jsx
useEffect(() => {
  // runs once on mount
}, []);
```

**2. Setting state that's also a dependency**

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // ❌ count changes → effect runs → count changes → ...
```

If you need the previous value, use a functional update and drop the dependency:

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // ✅
```

**3. Objects, arrays, or functions as dependencies**

React compares dependencies with `Object.is`, which checks **reference**, not contents. `{a: 1}` and `{a: 1}` are *different* objects, so anything created inside the component body is "new" on every render:

```jsx
const filters = { status: 'active' };
useEffect(() => { ... }, [filters]); // ❌ new object every render
```

Fixes: depend on primitive values instead, move the object inside the effect, or memoize it with `useMemo` / `useCallback`.

## A full example

Here's a data-fetching component that applies these ideas. **It contains exactly one bug that will still cause an infinite loop.** See if you can find it before running it.

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const requestOptions = {
    userId,
    headers: { Accept: 'application/json' },
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${requestOptions.userId}`, {
      headers: requestOptions.headers,
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch(err => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true; // ignore results from stale requests
    };
  }, [requestOptions]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <h1>{user?.name}</h1>;
}
```

A debugging tip: if you suspect a loop, put `console.log('effect ran')` inside the effect. If it floods the console, look at each item in the dependency array and ask, *"Is this a new value on every render?"*

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

<details><summary>#3 pass · first token 8390ms · total 15758ms</summary>

# Why useEffect Loops Forever

An infinite loop happens when **the effect causes a re-render, and that re-render triggers the effect again.** The usual causes are:

1. **No dependency array.** The effect runs after *every* render.
   ```jsx
   useEffect(() => {
     setCount(count + 1); // re-render → effect → re-render → ...
   });
   ```

2. **Setting state that's also a dependency.**
   ```jsx
   useEffect(() => {
     setCount(count + 1);
   }, [count]); // count changes → effect runs → count changes → ...
   ```

3. **Dependencies that change identity on every render.** React compares dependencies with `Object.is`, which checks *reference* for objects, arrays and functions, not their contents.

## The General Fixes

- **Run once on mount:** use an empty array `[]`.
- **Depend only on what the effect actually reads,** preferably primitives like strings and numbers.
- **Don't read state just to update it.** Use a functional update instead: `setCount(c => c + 1)`.
- **Stabilize non-primitive values** with `useMemo`, `useCallback`, or by moving them inside the effect or outside the component.

## A Complete Example

Here's a component that fetches a user whenever `userId` changes. **There is exactly one bug in this code that will still cause an infinite loop.** Try to find it before running it.

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const query = { id: userId, include: 'posts' };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${query.id}?include=${query.include}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      });

    // Cleanup: ignore responses from stale requests
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) return <p>Loading...</p>;
  return <h1>{user.name}</h1>;
}
```

The `cancelled` flag in the cleanup function is a good habit. It prevents a slow, outdated request from overwriting newer data after `userId` changes.

**Debugging tip:** If you're unsure what's re-triggering an effect, temporarily log each dependency inside it. The ESLint rule `react-hooks/exhaustive-deps` will also flag many of these problems automatically.

In your own words, what determines when React decides to re-run a `useEffect`?

</details>

<details><summary>#4 pass · first token 7731ms · total 17589ms</summary>

An infinite `useEffect` loop almost always follows this pattern:

1. The effect runs.
2. The effect updates state (`setSomething`).
3. The state change triggers a re-render.
4. After the render, React decides the effect needs to run again.
5. Go back to step 1.

The fix is to make sure step 4 doesn't happen unless something has actually changed. That comes down to the dependency array.

## The three most common causes

**1. No dependency array at all**

```jsx
useEffect(() => {
  fetch('/api/user').then(r => r.json()).then(setUser);
}); // no array: runs after EVERY render
```

Without a second argument, the effect runs after every render. Each `setUser` triggers a render, so the loop never ends.

**2. A dependency that's recreated on every render**

```jsx
const options = { method: 'GET' }; // new object every render

useEffect(() => {
  fetch('/api/user', options).then(r => r.json()).then(setUser);
}, [options]); // options is never "the same" twice
```

React compares dependencies with `Object.is`. A freshly created object, array, or function is never equal to the previous one, so the effect always reruns.

**3. Depending on the state the effect itself sets**

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // updates count, which triggers the effect again
```

## The fixes

- **Always pass a dependency array.** Use `[]` if the effect should run only on mount.
- **List only the values the effect actually reads**, and make sure those values are stable.
- **Move objects and functions inside the effect**, or stabilize them with `useMemo` or `useCallback`.
- **Use functional updates** (`setCount(c => c + 1)`) so you don't need the state in the dependency array.
- Turn on the `react-hooks/exhaustive-deps` ESLint rule. It catches most of these mistakes.

## A complete example

Here is a component that fetches a user's posts whenever `userId` changes, using the patterns above.

**Heads up: I've deliberately left exactly one bug in this code, and it will still cause an infinite loop. See if you can find it before running it.**

```jsx
import { useState, useEffect, useCallback } from 'react';

function UserPosts({ userId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Stabilize the fetch function so it isn't recreated every render
  const fetchPosts = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/posts`, { signal });
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, posts]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(controller.signal);

    // Cleanup: cancel the request if userId changes or the component unmounts
    return () => controller.abort();
  }, [fetchPosts]);

  if (loading) return <p>Loading…</p>;

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

To find it, trace the render cycle by hand. Ask what changes after `setPosts` runs, and whether that change makes the effect fire again.

In your own words, what is a `useEffect` dependency array actually telling React?

</details>

<details><summary>#5 pass · first token 7229ms · total 15795ms</summary>

An infinite `useEffect` loop almost always follows this cycle:

1. The effect runs.
2. The effect updates state.
3. The state update causes a re-render.
4. React decides the effect needs to run again, and the cycle repeats.

To break it, you control **when** React re-runs the effect. That's what the dependency array does.

## The three common culprits

**1. No dependency array at all**

```jsx
useEffect(() => {
  setCount(count + 1); // runs after EVERY render, forever
});
```

Without a second argument, the effect runs after every render.

**2. Depending on the state you're setting**

```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // items changes, effect runs, items changes again...
```

**3. Depending on something recreated every render**

React compares dependencies with `Object.is`, which checks identity for objects. Objects, arrays, and functions declared in the component body are brand-new on each render, so React treats them as "changed" every time.

## Fixes

- **Run once on mount:** pass an empty array `[]`.
- **Run when specific values change:** list only primitives (strings, numbers, booleans) or stable references.
- **Need previous state?** Use the functional updater so the state doesn't have to be a dependency:
  ```jsx
  setItems(prev => [...prev, newItem]);
  ```
- **Need an object or function as a dependency?** Stabilize it with `useMemo` or `useCallback`, or move it inside the effect.

## A full example

Here's a component that fetches users for a team, applies these ideas, and cleans up properly. **There is exactly one bug in this code that will still cause an infinite loop. See if you can find it.**

```jsx
import { useState, useEffect } from "react";

function UserList({ teamId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = { teamId, active: true };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users?team=${query.teamId}&active=${query.active}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setUsers(data);
          setLoading(false);
        }
      });

    // Cleanup: ignore stale responses if the effect re-runs or the component unmounts
    return () => {
      cancelled = true;
    };
  }, [query]);

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

As you hunt, ask of each dependency: *"Is this value actually the same between renders, or does it only look the same?"* Opening the Network tab in DevTools and watching for repeated requests will confirm whether you've fixed it.

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

### L4: 5/5

<details><summary>#1 pass · first token 3031ms · total 16036ms</summary>

An infinite `useEffect` loop almost always means the effect **updates something that triggers a re-render, and that re-render causes the effect to run again**. Here are the most common causes and how to fix each one.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, so it runs again forever.
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run only once on mount:

```jsx
// ✅ Runs once after the first render
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

---

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update so you don't need the state as a dependency:

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

Or add a condition so it eventually stops:

```jsx
useEffect(() => {
  if (count < 10) setCount(count + 1);
}, [count]);
```

---

## 3. Object, array, or function dependencies

React compares dependencies with `Object.is` (reference equality). Objects, arrays, and functions created during render are **new every render**, so the effect always sees them as "changed."

```jsx
// ❌ `options` is a new object every render
const options = { userId: id };

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**Fixes (pick one):**

**a) Depend on primitives instead:**
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

**c) Memoize it with `useMemo`:**
```jsx
const options = useMemo(() => ({ userId: id }), [id]);

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**For functions, use `useCallback`:**
```jsx
// ❌ loadData is recreated every render
const loadData = () => fetch(`/api/${id}`).then(r => r.json()).then(setData);

// ✅
const loadData = useCallback(() => {
  fetch(`/api/${id}`).then(r => r.json()).then(setData);
}, [id]);

useEffect(() => {
  loadData();
}, [loadData]);
```

---

## 4. Setting state to a new object/array with the same contents

```jsx
// ❌ Even if the data is identical, [...items] is a new reference
useEffect(() => {
  setFiltered(items.filter(i => i.active));
}, [items, filtered]);
```

**Fix:** Don't include the state you're setting in the dependencies. Better yet, if you're just deriving data, **you don't need an effect at all**:

```jsx
// ✅ Compute during render
const filtered = useMemo(() => items.filter(i => i.active), [items]);
```

---

## 5. Values you need but shouldn't react to: use `useRef`

If you need to read a value inside an effect without re-running when it changes:

```jsx
const latestValue = useRef(value);
latestValue.current = value;

useEffect(() => {
  const id = setInterval(() => {
    console.log(latestValue.current); // always current, no re-run
  }, 1000);
  return () => clearInterval(id);
}, []);
```

---

## Quick debugging checklist

1. **Do you have a dependency array?** If not, add one.
2. **Does the effect set state that's in its own dependency array?** Use a functional update or a condition.
3. **Are any dependencies objects, arrays, or functions defined in the component?** Replace with primitives, move them inside the effect, or memoize them.
4. **Is the effect just computing derived data?** Remove the effect and compute it during render.
5. **Turn on the ESLint rule** `react-hooks/exhaustive-deps`. It catches many of these issues.

> **Note:** In development with `<React.StrictMode>`, effects intentionally run **twice** on mount. That's not an infinite loop, and it won't happen in production.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#2 pass · first token 1071ms · total 12786ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array** (or you have no dependency array at all). Here are the common causes and fixes.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render → setData triggers a render → runs again...
useEffect(() => {
  fetchData().then(setData);
});

// ✅ Runs once on mount
useEffect(() => {
  fetchData().then(setData);
}, []);
```

## 2. Setting state that's also a dependency

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

## 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is`, so a **new object/array/function created each render is always "different."**

```jsx
// ❌ `options` is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

**Fixes (pick one):**

```jsx
// a) Depend on primitive values instead
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

Same for functions: define them inside the effect, or wrap them in `useCallback`:

```jsx
const loadData = useCallback(() => {
  fetchData(page).then(setData);
}, [page]);

useEffect(() => {
  loadData();
}, [loadData]);
```

## 4. Props that are recreated by the parent

If a parent passes `onChange={() => ...}` or `config={{...}}`, it's a new reference every render. Fix it in the parent with `useCallback` / `useMemo`, or depend on specific primitive fields in the child.

## 5. Setting state unconditionally from derived data

```jsx
// ❌
useEffect(() => {
  setFiltered(items.filter(i => i.active));
}, [items]); // fine only if `items` is stable
```

Often you don't need state or an effect at all, just compute during render:

```jsx
const filtered = useMemo(() => items.filter(i => i.active), [items]);
// or simply: const filtered = items.filter(i => i.active);
```

---

## Debugging checklist

1. **Does it have a dependency array?** If not, add one.
2. **Does the effect set state that's in the array?** Use a functional update or rethink the logic.
3. **Are any dependencies objects, arrays, or functions?** Make them stable or use primitives.
4. **Do you need the effect at all?** Derived values should be computed during render (see React's ["You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect)).
5. **Add a guard** if you truly must set state conditionally:
   ```jsx
   useEffect(() => {
     if (value !== desired) setValue(desired);
   }, [value, desired]);
   ```

Also, enable the `eslint-plugin-react-hooks` `exhaustive-deps` rule. It flags most of these problems. Don't silence its warnings by removing dependencies; fix the root cause instead.

> **Note:** In development with `<StrictMode>`, effects intentionally run **twice** on mount. That's not an infinite loop and doesn't happen in production.

If you share your specific effect code, I can point out exactly what's causing the loop.

</details>

<details><summary>#3 pass · first token 2615ms · total 13068ms</summary>

An infinite `useEffect` loop happens when the effect updates something that causes a re-render, and that re-render makes the effect run again. Here are the usual causes and their fixes.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData triggers a render, which runs the effect again, and so on.
useEffect(() => {
  fetchData().then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run only once on mount.

```jsx
// ✅ Runs once after the first render
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

## 2. Updating a state value that's also a dependency

```jsx
// ❌ count changes, the effect runs, count changes again...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update and remove the dependency, or add a condition.

```jsx
// ✅ Functional update, so count isn't needed as a dependency
useEffect(() => {
  setCount(c => c + 1);
}, []);

// ✅ Or guard it with a condition
useEffect(() => {
  if (count < 10) setCount(count + 1);
}, [count]);
```

---

## 3. Objects, arrays, or functions as dependencies

React compares dependencies by **reference**. Objects, arrays, and functions created during render are new on every render, so the effect always sees them as "changed."

```jsx
// ❌ options is a new object every render
const options = { userId: id };

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**Fixes (pick one):**

**a) Depend on primitive values instead**
```jsx
useEffect(() => {
  fetchUser({ userId: id }).then(setUser);
}, [id]); // ✅ id is a string or number, so it's stable
```

**b) Move the object inside the effect**
```jsx
useEffect(() => {
  const options = { userId: id };
  fetchUser(options).then(setUser);
}, [id]);
```

**c) Memoize with `useMemo` or `useCallback`**
```jsx
const options = useMemo(() => ({ userId: id }), [id]);

const loadUser = useCallback(() => {
  return fetchUser(options);
}, [options]);

useEffect(() => {
  loadUser().then(setUser);
}, [loadUser]); // ✅ stable reference unless id changes
```

---

## 4. Setting state to a new object or array every time

```jsx
// ❌ Even if the data is identical, a new array is a new reference
useEffect(() => {
  setItems([...rawItems]);
}, [items]);
```

**Fix:** Don't depend on the state you're setting. Ask whether you need state at all, since derived values can often be computed during render:

```jsx
// ✅ No effect needed
const items = useMemo(() => rawItems.filter(i => i.active), [rawItems]);
```

---

## Quick debugging checklist

1. **Is there a dependency array?** If not, add one.
2. **Does the effect set a state that's in its own dependency list?** Use a functional update or add a condition.
3. **Are any dependencies objects, arrays, or functions?** Replace them with primitives, move them inside the effect, or memoize them.
4. **Do you even need the effect?** If you're computing a value from props or state, compute it directly during render.
5. **Enable the ESLint rule** `react-hooks/exhaustive-deps`. It catches many of these issues.

> **Note:** In development with `<React.StrictMode>`, effects intentionally run **twice** on mount. That's expected, not an infinite loop. It won't happen in production.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#4 pass · first token 1893ms · total 13641ms</summary>

An infinite `useEffect` loop happens when the effect **updates something that triggers a re-render, and that re-render causes the effect to run again**. Here are the most common causes and how to fix each one.

---

## 1. No dependency array

```jsx
// ❌ Runs after EVERY render, and setData causes a render → infinite loop
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run only once, after the first render (on mount).

```jsx
// ✅
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

---

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a **functional update** so you don't need the state as a dependency. Better still, ask whether this belongs in an effect at all.

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

## 3. Object, array, or function dependencies

React compares dependencies with `Object.is`, i.e. by **reference**. Objects, arrays, and functions created during render are new on every render, so the effect always sees them as "changed."

```jsx
// ❌ `options` is a new object every render
const options = { userId: id };

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**Fixes (pick one):**

**a) Depend on primitives instead:**
```jsx
useEffect(() => {
  fetchUser({ userId: id }).then(setUser);
}, [id]);
```

**b) Move the object inside the effect:**
```jsx
useEffect(() => {
  const options = { userId: id };
  fetchUser(options).then(setUser);
}, [id]);
```

**c) Memoize it with `useMemo`:**
```jsx
const options = useMemo(() => ({ userId: id }), [id]);

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

**d) For functions, use `useCallback`:**
```jsx
const loadUser = useCallback(() => {
  return fetchUser(id);
}, [id]);

useEffect(() => {
  loadUser().then(setUser);
}, [loadUser]);
```

---

## 4. Props that are recreated by the parent

If a parent passes `onChange={() => ...}` or `config={{...}}`, the child gets a new reference every render. Fix it in the parent with `useCallback` or `useMemo`, or have the child depend only on primitive values.

---

## 5. Only update state when the value actually changes

If you must set state from an effect, guard it:

```jsx
useEffect(() => {
  const next = computeSomething(input);
  setValue(prev => (prev === next ? prev : next));
}, [input]);
```

When you return the previous value from a functional update, React can skip the re-render.

---

## 6. Ask: do you even need an effect?

Many loops come from using an effect to **derive** state. Compute it during render instead:

```jsx
// ❌
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// ✅
const fullName = `${first} ${last}`;
```

---

## Debugging tips

- Install **`eslint-plugin-react-hooks`** and enable the `exhaustive-deps` rule. It flags missing and unstable dependencies.
- Temporarily log inside the effect to see which dependency is changing:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
- Note that **React Strict Mode** runs effects twice on mount in development. Running twice is expected behavior, not an infinite loop.

---

If you share your actual `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#5 pass · first token 1148ms · total 11531ms</summary>

An infinite `useEffect` loop almost always happens because **the effect updates something that causes it to run again**. Here are the common causes and how to fix each one.

---

## 1. Missing dependency array

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

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);

// ✅ Use a functional update and drop the dependency
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

Ask yourself whether this needs to be an effect at all. Often the value can be **derived during render** instead:

```jsx
// ❌ Effect + extra state
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// ✅ Just compute it
const fullName = `${first} ${last}`;
```

## 3. Objects, arrays, or functions as dependencies

These are **recreated on every render**, so React sees a "new" value each time (it compares with `Object.is`, i.e. by reference).

```jsx
// ❌ options is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

**Fixes:**

```jsx
// ✅ Option A: depend on primitive values instead
useEffect(() => {
  fetchData({ page }).then(setData);
}, [page]);

// ✅ Option B: move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchData(options).then(setData);
}, []);

// ✅ Option C: memoize it
const options = useMemo(() => ({ page }), [page]);
```

For functions, use `useCallback` or move the function inside the effect:

```jsx
// ❌ loadData is recreated every render
const loadData = () => fetchData(id).then(setData);
useEffect(() => { loadData(); }, [loadData]);

// ✅ useCallback
const loadData = useCallback(() => fetchData(id).then(setData), [id]);
useEffect(() => { loadData(); }, [loadData]);
```

## 4. Props that are new objects or functions from the parent

If the parent passes `onChange={() => ...}` or `config={{...}}`, the child's effect will rerun each time the parent renders. Fix it in the **parent** with `useCallback`/`useMemo`, or have the child depend on specific primitive fields (`config.id` instead of `config`).

---

## Quick debugging checklist

1. **Does the effect have a dependency array?** If not, add one.
2. **Does the effect set state that's in its own dependency list?** Use a functional update, or rethink the logic.
3. **Are any dependencies objects, arrays, or functions?** Stabilize them or replace them with primitives.
4. **Do you need the effect at all?** If you're just transforming props or state, compute the value during render.
5. **Enable the ESLint rule** `react-hooks/exhaustive-deps`. It catches many of these problems. Don't silence it by removing dependencies, since that causes stale-value bugs. Restructure the code instead.

> **Note:** In development with `<StrictMode>`, React 18+ intentionally runs effects **twice** on mount. That isn't an infinite loop. It only happens in dev and is meant to surface missing cleanup.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

### Demo answer graded against each L1 reply above

- #1: correct 0.88: The student correctly explains that the dependency array controls when the effect re-runs, re-running only when a listed value changes, and that an empty array means it runs once after mount, which is sufficient at this level.
- #2: correct 0.85: The student correctly explains that React re-runs an effect only when a value in the dependency array changes, and that an empty array means it runs once after mount, which is the central mechanism at this level.
- #3: correct 0.85: The student correctly explains that the dependency array determines when the effect re-runs, triggering only when a listed value changes, with an empty array meaning it runs once after mount, which is sufficient at this level.
- #4: correct 0.90: The student correctly explains that the dependency array determines when the effect re-runs (only when a listed value changes), and that an empty array means it runs once after mount, which is the central mechanism at this level.
- #5: correct 0.85: The student correctly explains that React re-runs the effect only when a value in the dependency array changes and that an empty array means it runs once after mount, which is sufficient at this level even though omitting the array and reference comparison aren't mentioned.

## Grading

| case | level | expected | got | confidence | new_level | time | rationale |
|---|---|---|---|---|---|---|---|
| repeats original question | L1 | not_an_answer / lazy | not_an_answer | 0.90 | L1 | 1688ms | The student asked a new question about stopping an infinite loop instead of explaining what the dependency array tells React. |
| rephrases original question | L1 | not_an_answer / lazy | not_an_answer | 0.90 | L1 | 1377ms | The student asked a new question about their own infinite loop instead of explaining what the dependency array tells React. |
| echoes the check question | L1 | not_an_answer / lazy | not_an_answer | 0.95 | L1 | 1529ms | The student only repeated the tutor's question back and gave no explanation of what the dependency array does. |
| keyword list | L1 | not_an_answer / partial / lazy | partial | 0.60 | L1 | 5122ms | The student's keywords point toward the right idea that the effect re-runs when listed values change, but they never form a clear explanation of how the array controls when the effect runs. |
| short genuine answer | L1 | correct | correct | 0.88 | L4 | 1421ms | The student correctly explains that the dependency array tells React to re-run the effect only when one of the listed values changes, which is the core idea at this level. |
| question-shaped answer | L1 | correct | correct | 0.85 | L4 | 4083ms | The student correctly explains that the dependency array lists the values the effect relies on and that React re-runs the effect only when one of those values changes, which is the core idea at this level. |
| demo correctAnswer | L1 | correct | correct | 0.93 | L4 | 3732ms | The student accurately explains that the dependency array tells React to re-run the effect only when listed values change, and correctly notes that an empty array means it runs once after mount. |
| demo lazyAnswer at L3 | L3 | lazy | lazy | 0.97 | L2 | 3615ms | The student asked for code instead of explaining what the dependency array tells React, so they did not engage with the question. |
| partial | L1 | partial | partial | 0.85 | L1 | 2025ms | The student correctly identifies the dependency array as the second argument and senses that it controls the effect, but does not explain that it tells React to re-run the effect only when the listed values change. |
| incorrect | L1 | incorrect | incorrect | 0.93 | L1 | 2139ms | The student thinks the dependency array controls which state the effect may update. It actually tells React which values to watch, so the effect re-runs only when one of them changes. |
| not_an_answer | L1 | not_an_answer | not_an_answer | 0.97 | L1 | 2714ms | The student asked an unrelated question about centering with flexbox and did not address what the dependency array tells React. |

## Classify (LLM fallback)

| prompt | expected | got | method | confidence | time |
|---|---|---|---|---|---|
| How can I share the current theme with deeply nested parts of my app without handing it down manually at every level? | Context API | Context API | llm | 0.96 | 978ms |
| Why does my list re-render every time its parent does, even when its data did not change? | Performance & Memoization | Performance & Memoization | llm | 0.85 | 1353ms |
| write a haiku about autumn leaves | null | null | none | 0.00 | 1342ms |

## Parse (`fixtures/demo-syllabus.md`)

### text: CSE 134R — React Fundamentals (14334ms)

- **Foundations**
  - `n1` JSX & Components · L3 major · code · [jsx, react.createelement, function component, adjacent jsx elements must be wrapped, fragment, component tree] · deps []  
    Explains what JSX compiles to (React.createElement / jsx calls) and decomposes a UI mockup into reusable function components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback props, props destructuring, lifting state up] · deps [n1]  
    Passes data and callbacks through props, uses the children prop, and explains one-way data flow
  - `n3` State with useState · L3 major · box · [usestate, setstate, functional update, state not updating, asynchronous state, re-render, batching] · deps [n1]  
    Uses useState correctly, including functional updates, and explains why a state value doesn't change immediately after calling the setter
- **Effects & Data**
  - `n4` React useEffect · L4 major · refresh · [useeffect, dependency array, cleanup function, infinite loop, too many re-renders, maximum update depth exceeded, side effects] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array, and writes correct cleanup functions
  - `n5` Data Fetching · L3 minor · download · [fetch, loading state, error handling, race condition, abortcontroller, async useeffect] · deps [n4]  
    Fetches data inside an effect with loading and error states, and prevents race conditions using cleanup or AbortController
  - `n6` Custom Hooks · L3 minor · hook · [custom hook, rules of hooks, use prefix, invalid hook call, hooks called conditionally, reusable logic] · deps [n4]  
    Extracts reusable stateful logic into a custom hook and explains the rules of hooks
- **Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, context provider, prop drilling, global state, context value undefined] · deps [n2, n3]  
    Shares state with createContext/useContext and justifies when context is better than prop drilling
  - `n8` Performance & Memoization · L4 major · zap · [react.memo, usememo, usecallback, unnecessary re-renders, referential equality, react profiler] · deps [n6, n7]  
    Diagnoses unnecessary re-renders and applies React.memo, useMemo, and useCallback appropriately, explaining when memoization is not worth it

### pdf: CSE 134R - React Fundamentals (11266ms)

- **Module 1 - Foundations**
  - `n1` JSX & Components · L3 major · code · [jsx, react.createelement, function component, component tree, fragment] · deps []  
    Explains what JSX compiles to and decomposes a mockup into reusable components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback props, prop types] · deps [n1]  
    Passes data and callbacks through props and explains one-way data flow
  - `n3` State with useState · L3 minor · refresh · [usestate, setstate, functional update, stale state, re-render] · deps [n1]  
    Uses useState correctly, including functional updates, and explains why state updates are asynchronous
- **Module 2 - Effects & Data**
  - `n4` React useEffect · L4 major · zap · [useeffect, dependency array, cleanup function, infinite loop, side effects, too many re-renders] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array
  - `n5` Data Fetching · L3 minor · download · [fetch, loading state, error state, race condition, abortcontroller, async useeffect] · deps [n4]  
    Fetches data in an effect with loading and error states and prevents race conditions
  - `n6` Custom Hooks · L3 minor · hook · [custom hook, rules of hooks, use prefix, invalid hook call, reusable logic] · deps [n4]  
    Extracts reusable stateful logic into a custom hook that follows the rules of hooks
- **Module 3 - Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, provider, prop drilling, global state] · deps [n3]  
    Uses createContext and useContext to share state and explains when context beats prop drilling
  - `n8` Performance & Memoization · L4 major · cpu · [react.memo, usememo, usecallback, unnecessary re-renders, memoization, referential equality] · deps [n6, n7]  
    Diagnoses unnecessary re-renders and fixes them appropriately with React.memo, useMemo, or useCallback

## 3-turn sandbox exchange

**Student (L1):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 1116ms):**

Infinite loops with `useEffect` are a common snag, and they usually come down to one key idea about *when* an effect decides to run again.

**Hint:** Look at what your effect does. If it updates state, ask yourself what happens to the component right after that update, and whether anything in that chain tells React the effect should fire again. The answer is often in the small array at the end of the `useEffect` call, or in its absence.

Before we look at your code, in your own words, how does React decide when to re-run a `useEffect`?

**Student (graded correct 0.85 → L4: The student correctly explains that React re-runs an effect only when a value in the dependency array changes, and that an empty array means it runs once after mount, which is the core mechanism expected at this level.):**

The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.

**Claude (first token 2364ms):**

Exactly right. React compares each value in the dependency array to its value from the previous render and only re-runs the effect if something changed. An empty array means "nothing to watch," so it runs once after mount.

An infinite loop happens when the effect **causes a change that makes it run again**. These are the usual culprits and their fixes.

---

### 1. No dependency array at all

```jsx
useEffect(() => {
  setCount(count + 1); // runs after EVERY render
});
```
Without an array, the effect runs after every render. Setting state triggers a render, which triggers the effect, and so on forever.

**Fix:** Add a dependency array.
```jsx
useEffect(() => {
  fetchData().then(setData);
}, []); // run once on mount
```

---

### 2. The effect updates a value it depends on

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // count changes → effect runs → count changes → ...
```

**Fix:** Use a functional update so you don't need the value as a dependency, or add a condition.
```jsx
useEffect(() => {
  setCount(c => c + 1); // no need to depend on count
}, []);
```
```jsx
useEffect(() => {
  if (count < 10) setCount(count + 1); // stops eventually
}, [count]);
```

---

### 3. Objects, arrays, or functions as dependencies (the sneaky one)

React compares dependencies with `Object.is`, meaning **by reference**. Objects, arrays, and functions created during render are brand-new on every render, so React always sees them as "changed."

```jsx
function Profile({ userId }) {
  const options = { id: userId };       // new object every render
  const load = () => fetchUser(userId); // new function every render

  useEffect(() => {
    load().then(setUser); // setUser → re-render → new options/load → effect runs again
  }, [options, load]);
}
```

**Fixes (pick one):**

- **Depend on primitives instead:**
  ```jsx
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  ```
- **Move the object/function inside the effect:**
  ```jsx
  useEffect(() => {
    const load = () => fetchUser(userId);
    load().then(setUser);
  }, [userId]);
  ```
- **Memoize it if it must live outside:**
  ```jsx
  const options = useMemo(() => ({ id: userId }), [userId]);
  const load = useCallback(() => fetchUser(userId), [userId]);
  ```

---

### Quick checklist when you hit a loop
1. Does the effect have a dependency array?
2. Does the effect set any state that's also in the array?
3. Are any dependencies objects, arrays, or functions created during render?
4. Turn on the `react-hooks/exhaustive-deps` ESLint rule. It catches most of these.

> Note: In development with `<StrictMode>`, React intentionally runs effects **twice** on mount. That's not an infinite loop, just a check that your cleanup works.

If you paste your actual `useEffect`, I can point out which of these is causing your loop.

**Student, new chat (L4, no block):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 1848ms):**

# Fixing Infinite Loops in `useEffect`

An infinite loop happens when your effect updates state, that update triggers a re-render, and the re-render runs the effect again. Here are the most common causes and their fixes.

---

## 1. Missing Dependency Array

Without a dependency array, the effect runs after **every** render.

```jsx
// ❌ Runs after every render, and setData triggers another render
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(setData);
});

// ✅ Runs once after the initial render
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(setData);
}, []);
```

---

## 2. Updating a State Variable That's Also a Dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update so you don't need `count` as a dependency. Also ask whether this logic belongs in an effect at all.

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

## 3. Objects, Arrays, or Functions as Dependencies

React compares dependencies by **reference**. Objects, arrays, and functions created during render are new on every render, so the effect always re-runs.

```jsx
// ❌ `options` is a new object every render
function Component() {
  const options = { userId: 1 };

  useEffect(() => {
    fetchData(options).then(setData);
  }, [options]);
}
```

### Fix A: Move it inside the effect
```jsx
useEffect(() => {
  const options = { userId: 1 };
  fetchData(options).then(setData);
}, []);
```

### Fix B: Depend on primitive values instead
```jsx
useEffect(() => {
  fetchData({ userId }).then(setData);
}, [userId]); // number/string compares by value
```

### Fix C: Memoize with `useMemo` / `useCallback`
```jsx
const options = useMemo(() => ({ userId }), [userId]);

const loadData = useCallback(() => {
  return fetchData(options);
}, [options]);

useEffect(() => {
  loadData().then(setData);
}, [loadData]);
```

### Fix D: Move it outside the component
If it doesn't depend on props or state, define it outside the component entirely:
```jsx
const OPTIONS = { userId: 1 };

function Component() {
  useEffect(() => {
    fetchData(OPTIONS).then(setData);
  }, []);
}
```

---

## 4. Setting State to a New Object or Array Each Time

```jsx
// ❌ Even if contents are identical, a new array means a new reference
useEffect(() => {
  setItems([...rawItems]);
}, [items]);
```

**Fix:** Don't depend on the state you're setting. Often this is **derived state** and doesn't need an effect at all:

```jsx
// ✅ Just compute it during render
const filteredItems = useMemo(
  () => rawItems.filter(i => i.active),
  [rawItems]
);
```

---

## 5. Function Props from a Parent

If a parent passes an inline function, it's new on every render:

```jsx
// Parent
<Child onLoad={() => console.log('loaded')} />  // ❌ new function every render

// Child
useEffect(() => {
  onLoad();
}, [onLoad]); // re-runs on every parent render
```

**Fix:** Wrap the function in `useCallback` in the parent:
```jsx
const handleLoad = useCallback(() => console.log('loaded'), []);
<Child onLoad={handleLoad} />
```

---

## Quick Debugging Checklist

1. **Is there a dependency array?** If not, add one.
2. **Does the effect set state that's in its own dependency list?** Use a functional update or restructure.
3. **Are any dependencies objects, arrays, or functions?** Move them inside the effect, use primitives, or memoize them.
4. **Do you even need an effect?** If you're computing a value from props or state, calculate it during render instead.
5. **Enable the ESLint rule** `react-hooks/exhaustive-deps`. It flags missing and unstable dependencies.

### Tip: Find what's changing
```jsx
useEffect(() => {
  console.log('Effect ran', { dep1, dep2 });
}, [dep1, dep2]);
```
Watch which value changes on every run. That's your culprit.

---

If you share the specific effect that's looping, I can point out exactly what's causing it.
