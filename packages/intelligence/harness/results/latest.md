# Harness results

Run: 2026-10-24T08:21:04.167Z · models: chat=claude-opus-5-5 grade=claude-opus-5-5 classify=claude-haiku-5-5 parse=claude-opus-5-5

## Summary

- L1: **5/5** (CP2 gate ≥4)
- L2: **5/5** (CP2 gate ≥4)
- L3: **5/5** (CP3 gate ≥4)
- L4: **5/5** (CP2 gate ≥4)
- Demo answer vs the real L1 quizzes: **5/5** correct
- Grading: **5/5** match
- Classify fallback: **3/3**
- Parse text: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 9630ms)
- Parse pdf: **pass** (3 pillars, 8 nodes, useEffect present, demo question routes to it, 9833ms)
- 3-turn exchange: **pass** (automatic checks; read the transcript for naturalness)

## Level compliance (`DEMO_PROMPTS.question`)

### L1: 5/5

<details><summary>#1 pass · first token 1200ms · total 3209ms</summary>

Infinite loops with `useEffect` are a common snag, and once you see the pattern behind them, they're much easier to spot and prevent.

Rather than handing you a fix, let's work through *why* the loop happens, because the cause tells you the cure.

**Hint:** Look at what your effect *does*. If it changes state or creates a new value, ask yourself what happens to the component right after that change, and whether anything then tells the effect to run *again*. The second argument you pass to `useEffect` (or leave out) is a big part of the story.

In your own words, what decides when a `useEffect` runs?

</details>

<details><summary>#2 pass · first token 987ms · total 3265ms</summary>

An infinite loop with `useEffect` almost always comes down to *when* React decides to run the effect again. Think about what happens step by step: your component renders, the effect runs, and then something in that effect may cause the component to render again.

**Hint:** Look at the second argument you pass to `useEffect` (or notice whether you're passing one at all). Then check whether your effect updates any piece of state that the effect itself depends on. Picture the cycle "render → effect → state change → render" and ask what would ever make it stop.

Before we dig into your specific code, how would you describe in your own words what decides whether `useEffect` runs again after a render?

</details>

<details><summary>#3 pass · first token 1083ms · total 3001ms</summary>

Infinite loops with `useEffect` usually come down to one thing: what triggers the effect to run again, and whether the effect itself causes that trigger.

**Hint:** Think about the cycle. Your effect runs after a render. If the effect updates state, that causes another render. What does React check after that render to decide whether to run the effect again? Look closely at what you're passing as the second argument to `useEffect`, or whether you're passing one at all.

If you share your effect, we can trace the cycle step by step.

In your own words, what decides when a `useEffect` runs again after a re-render?

</details>

<details><summary>#4 pass · first token 1083ms · total 3959ms</summary>

Infinite loops with `useEffect` almost always come down to *when* React decides to run your effect, so it's worth working out the cause rather than just patching it.

**A hint:** Trace what happens step by step. Your component renders, then the effect runs. Ask yourself:

- Does the effect change anything (like state) that causes another render?
- After that render, what tells React whether to run the effect again?
- Look at the second argument you pass to `useEffect`, or notice if it's missing. What role might it play in that decision?

If you follow that cycle once or twice, you'll probably see where the loop closes on itself.

In your own words, what determines when a `useEffect` callback runs after a render?

</details>

<details><summary>#5 pass · first token 1083ms · total 3438ms</summary>

Infinite loops with `useEffect` almost always come down to *when* React decides to run the effect again. Once that's clear, the fix usually follows.

**Hint:** Look at what your effect *does* (does it update state?) and then at what's in the dependency array, or whether there is one at all. Trace what happens after your effect runs: what changes, what React does in response, and whether that sends you back to the start.

If you'd like, paste your effect afterward and we can trace it step by step.

In your own words, what determines when a `useEffect` runs again after the first render?

</details>

### L2: 5/5

<details><summary>#1 pass · first token 2640ms · total 11243ms</summary>

An infinite `useEffect` loop almost always follows the same cycle:

1. The component renders.
2. The effect runs.
3. The effect **updates state**.
4. The state change causes a **re-render**, which brings you back to step 2.

The fix is to tell React *when* the effect actually needs to re-run, using the **dependency array**.

## Step 1: Check whether you have a dependency array

With no second argument, the effect runs after **every** render. If it also sets state, it loops forever.

```
useEffect( () => {
    ____ // your side effect (fetch, subscribe, etc.)
}, ____ )   // <- what goes here?
```

Ask yourself which version you need:

| Second argument | When the effect runs |
|---|---|
| *(nothing)* | After every render |
| `[ ]` (empty) | ____ |
| `[ someValue ]` | ____ |

## Step 2: Don't depend on the state you're setting

A common trap is updating the same value that's listed as a dependency:

```
useEffect( () => {
    set____( ____ + 1 )
}, [ ____ ] )   // if this is the same value you just set, what happens?
```

If you need the previous value, consider the **updater function** form of the setter, so the value itself doesn't need to be a dependency:

```
set____( (prev) => ____ )
```

## Step 3: Watch out for objects, arrays, and functions

Even with a dependency array, the loop can continue if a dependency is **recreated on every render**:

```
const options = { ____ }        // new object each render
const handler = () => { ____ }  // new function each render

useEffect( () => { ____ }, [ options ] )  // React sees a "new" value every time
```

Possible fixes to explore:
- Move the object or function **inside** the effect, or **outside** the component.
- Depend on the **primitive values** (strings, numbers) inside the object instead of the object itself.
- Memoize it with `useMemo` (for values) or `useCallback` (for functions).

## Debugging checklist

- [ ] Does the effect have a dependency array?
- [ ] Does the effect set any state that's also in the dependency array?
- [ ] Are any dependencies objects, arrays, or functions created during render?
- [ ] Does each dependency actually need to trigger a re-run?

Try filling in the blanks for your own component. If you share the effect that's looping, I can help you spot which step applies.

In your own words, what does the dependency array tell React about when an effect should run?

</details>

<details><summary>#2 pass · first token 2023ms · total 11160ms</summary>

An infinite loop with `useEffect` almost always follows the same cycle:

1. The component renders.
2. The effect runs and **updates state** (or something else that triggers a re-render).
3. The re-render makes React think the effect needs to run **again**.
4. Back to step 2, forever.

The fix is to break that cycle, usually by controlling **when** the effect re-runs. That's the dependency array's job.

---

### Step 1: Check the dependency array

Ask yourself which of these your effect looks like:

| Dependency array | When the effect runs |
|---|---|
| *(missing entirely)* | after **every** render |
| `____` (empty) | only **once**, after the first render |
| `[ ____ ]` (some values) | only when one of those values **changes** |

If your effect sets state and has **no dependency array at all**, that's your loop.

---

### Step 2: Fill in the outline

```
useEffect( () => {
    // do the side effect (fetch data, subscribe, etc.)
    ____ ( newValue )        // the state setter
}, ____ )                    // what should go here?
```

Ask yourself:
- Should this effect run **once**, or **whenever something specific changes**?
- Is the state you're *setting* also listed in the dependency array? If so, the effect triggers itself. That's a loop.

---

### Step 3: Watch for "sneaky" dependencies

Even with a dependency array, you can still loop if a dependency is **recreated on every render**:

```
inside component:
    options = { ____ }            // new object every render
    handleData = function ____    // new function every render

useEffect( ..., [ options ] )      // always "changed"
```

React compares dependencies by **reference**, so a brand-new object, array, or function counts as "changed" every render, even if its contents look identical.

Ways to stabilize it (fill in which fits your case):
- Move the object or function **outside** the component, or **inside** the effect itself
- Depend on a **primitive** (like `options.id`) instead of the whole object
- Wrap a function with `use____` or an object with `use____` so it keeps the same reference

---

### Step 4: Guard against unnecessary updates (optional)

If the effect *must* depend on a value it also updates, add a condition:

```
if ( ____ !== ____ ) {
    setValue( ____ )
}
```

That way it only updates when the value actually differs, and the cycle stops.

---

**Quick checklist:**
- ☐ Does the effect have a dependency array?
- ☐ Does it set state that's also in its own dependencies?
- ☐ Are any dependencies objects, arrays, or functions created during render?

If you paste your effect, I can help you work out which case it is.

In your own words, what does the dependency array tell React about when to run an effect?

</details>

<details><summary>#3 pass · first token 1250ms · total 9740ms</summary>

An infinite loop with `useEffect` almost always comes from this cycle:

1. The effect runs.
2. Inside it, you **update state** (or create a new object/array/function).
3. That update causes a **re-render**.
4. After the re-render, React decides the effect needs to run again, so you're back at step 1.

The thing that controls step 4 is the **dependency array**, the second argument to `useEffect`.

### How React decides whether to re-run

| Dependency array | When the effect runs |
|---|---|
| *(omitted entirely)* | After **every** render |
| `[]` (empty) | Only **once**, after the first render |
| `[a, b]` | After the first render, then only when `a` or `b` **changes** |

If you leave the array out and set state inside the effect, you've built a loop.

### Outline to fix it

```
useEffect( () => {
    // do your work here (fetch data, subscribe, etc.)
    ____ ( newValue )   // the state update
}, ____ )               // what goes here?
```

Ask yourself:

- **Should this run only once (on mount)?** Then the blank after the comma should be ____.
- **Should it re-run when some specific value changes?** Then list ____ in the array, and *not* the state you're setting inside the effect (unless you guard it).

### Common sneaky causes (even with an array)

- **Including the state you set.** If the effect sets `count` and `count` is in the array, it re-triggers itself. Either remove it or add a condition like `if (____) return`.
- **Objects, arrays, or functions as dependencies.** These are recreated on every render, so React sees them as "changed" each time, even if their contents are identical. Consider:
  - moving them **inside** the effect,
  - depending on a ____ (primitive) value instead of the whole object, or
  - memoizing them with `useMemo` / `useCallback`.

### Quick checklist

1. Does the effect update state? → Which state?
2. Is that same state (or something derived from it) in the dependency array?
3. Are any dependencies objects/functions created during render?
4. Is the dependency array missing altogether?

Try filling in the blanks for your specific effect. If you share your code, I can help you spot which of these is the culprit.

In your own words, what does the dependency array tell React about when your effect should run?

</details>

<details><summary>#4 pass · first token 1351ms · total 9202ms</summary>

An infinite `useEffect` loop almost always comes from this cycle:

1. The component renders
2. The effect runs and **updates state**
3. The state change triggers a **re-render**
4. The effect runs again, so you go back to step 2

To break the cycle, you need to control *when* the effect re-runs. That's the job of the **dependency array**, the second argument to `useEffect`.

### The three cases

| Dependency array | When the effect runs |
|---|---|
| Missing entirely | After **every** render (the usual loop culprit) |
| Empty `[]` | Only **once**, after the first render |
| `[a, b]` | Only when `a` or `b` **changes** |

### Outline of a fix

```
useEffect( () => {
    fetch or compute something
    call ____ (your state setter) with the result
}, ____ )   // <- what goes here decides when this re-runs
```

Fill the second blank by asking: *"Which values, if they changed, should cause this effect to run again?"*

- If the answer is "nothing, just do it on mount," the blank is ____.
- If it depends on a prop like `userId`, the blank should contain ____.

### Common traps, even with a dependency array

- **Including the state you're setting.** If the effect sets `data` and `data` is in the array, every update re-triggers the effect. Ask yourself whether the effect really needs to *read* that value.
- **Objects, arrays, or functions created during render.** Something like `const options = { ... }` inside the component is a *new reference* on every render, so React sees it as "changed" each time. Possible fixes:
  - move it ____ the component (outside), or
  - memoize it with ____ (for objects/arrays) or ____ (for functions), or
  - depend on its primitive fields instead of the whole object.
- **Updating state based on the previous state.** Instead of reading `count` and listing it as a dependency, use the ____ form of the setter, `setCount(prev => ____)`, so `count` doesn't need to be in the array.

### Debugging checklist

1. Does the effect call a state setter? → ____
2. Is there a dependency array at all? → ____
3. Is anything in the array an object, array, or function defined in the component body? → ____
4. Is the state being set also listed as a dependency? → ____

If you share your effect code, I can help you figure out which of these is causing your loop.

In your own words, what does the dependency array tell React about when an effect should run?

</details>

<details><summary>#5 pass · first token 2680ms · total 9818ms</summary>

An infinite loop with `useEffect` almost always comes from this cycle:

**render → effect runs → effect updates state → state change triggers re-render → effect runs again → …**

The fix is to tell React exactly *when* the effect should re-run. That's what the **dependency array** is for.

---

### Step 1: Diagnose which pattern you have

Check your effect against these common culprits:

| Symptom | Likely cause |
|---|---|
| No second argument to `useEffect` at all | Effect runs after **every** render |
| You set a state variable that's also listed as a dependency | Effect changes its own trigger |
| A dependency is an object, array, or function created inside the component body | It's a **new reference** each render, so React thinks it changed |

---

### Step 2: Fill in the outline

```
useEffect( () => {
    // do the side effect (fetch, subscribe, etc.)
    // possibly: update some state with ____
}, [ ____ ] )
```

Ask yourself for the blank in the brackets:

- Should this run **only once** after the first render? The array should contain ____.
- Should it re-run **when a specific value changes**? Put ____ in the array.
- Are you updating a state variable *and* listing it as a dependency? Consider using the ____ form of the setter (the one that receives the previous value) so you can remove that state from the array.

---

### Step 3: Stabilize "unstable" dependencies

If a dependency is an object, array, or function defined in your component:

```
// Option A: move its creation ____ the effect
// Option B: memoize it with ____ (for values) or ____ (for functions)
// Option C: depend on a primitive piece of it (e.g. obj.____) instead of the whole object
```

---

### Step 4: Verify

Add a temporary log inside the effect. After your change, it should print only when the values you intended actually change, not continuously.

---

If you paste your effect, I can help you figure out which of these patterns applies.

In your own words, what does the dependency array tell React to do?

</details>

### L3: 5/5

<details><summary>#1 pass · first token 7566ms · total 16571ms</summary>

An infinite `useEffect` loop almost always follows the same cycle:

1. The component renders.
2. The effect runs and **updates state**.
3. The state update triggers a **re-render**.
4. React checks the dependency array, decides the effect should run again, and you're back at step 2.

## Common causes

**1. No dependency array at all**
```jsx
useEffect(() => {
  setCount(count + 1);
}); // runs after EVERY render, so it loops forever
```

**2. Depending on the same state you set**
```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // items changes, effect runs, items changes again...
```
Fix: use the functional updater (`setItems(prev => [...prev, newItem])`) and remove `items` from the deps.

**3. Objects, arrays, or functions as dependencies**
React compares dependencies by reference (`Object.is`). Any object, array, or function **created inside the component body** is a brand-new reference on every render, so React treats it as "changed" every time.
```jsx
const config = { page: 1 };       // new object every render
useEffect(() => { ... }, [config]); // runs every render
```
Fix: move it outside the component, wrap it in `useMemo`/`useCallback`, or depend on the primitive values inside it (e.g. `config.page`).

## A full example

Here's a data-fetching component written with these rules in mind. **It still contains exactly one bug that will cause an infinite loop.** See if you can find it before running it:

```jsx
import { useEffect, useState } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOptions = {
    headers: { Accept: 'application/json' },
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${userId}`, fetchOptions)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Cleanup: ignore results if userId changes or the component unmounts
    return () => {
      cancelled = true;
    };
  }, [userId, fetchOptions]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <h1>{user?.name}</h1>;
}

export default UserProfile;
```

**Debugging tips while you hunt:**
- Put a `console.log('effect ran', ...)` at the top of the effect and watch how often it fires.
- Install the `eslint-plugin-react-hooks` rule `exhaustive-deps`. It catches many of these problems before they reach the browser.
- For each item in a dependency array, ask whether it's a primitive or something that gets recreated on every render.

In your own words, what is `useEffect` actually for?

</details>

<details><summary>#2 pass · first token 6854ms · total 15538ms</summary>

An infinite `useEffect` loop almost always follows this cycle:

1. The component renders.
2. The effect runs and **updates state**.
3. The state change triggers a **re-render**.
4. React checks the dependency array, sees something "changed," and **runs the effect again**.
5. Repeat forever.

To break the cycle, make sure the effect only re-runs when something *meaningful* changes.

## The three usual causes

**1. No dependency array at all**

```jsx
useEffect(() => {
  setCount(count + 1);
}); // runs after EVERY render
```

Without a second argument, the effect runs after every render. If it sets state, it loops.

**2. Depending on the state you're setting**

```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // setting items -> items changes -> effect runs again
```

Fix this with a functional update so you don't need `items` as a dependency:

```jsx
useEffect(() => {
  setItems(prev => [...prev, newItem]);
}, [newItem]);
```

**3. Objects, arrays, or functions created during render**

React compares dependencies with `Object.is`, which checks *reference* equality for objects. `{a: 1} !== {a: 1}`, so a freshly created object is "different" every render. Depend on primitive values instead, or stabilize the object with `useMemo` or `useCallback`.

## A full example

Here's a component that fetches posts for a user, with a loading state and cleanup to avoid setting state after unmount:

```jsx
import { useEffect, useState } from "react";

function UserPosts({ userId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = { userId, limit: 10 };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/posts?userId=${query.userId}&limit=${query.limit}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) return <p>Loading...</p>;

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

export default UserPosts;
```

⚠️ **There is exactly one bug in this code, and it causes the very infinite loop you're trying to avoid.** See if you can find it by tracing what happens after `setPosts` and `setLoading` trigger a re-render. Which value in the dependency array does React think has changed?

Once you've found it, there are a couple of valid ways to fix it. Consider which one is cleanest.

**Debugging tip:** If you're unsure which dependency is triggering the loop, temporarily add `console.log` statements for each dependency inside the effect. You can also install the `eslint-plugin-react-hooks` lint rule, which flags many of these issues automatically.

In your own words, what determines whether a `useEffect` runs again after a render?

</details>

<details><summary>#3 pass · first token 7112ms · total 16179ms</summary>

# Fixing an Infinite `useEffect` Loop

An infinite loop happens when your effect **updates something that causes the effect to run again**. The cycle looks like this:

```
render → effect runs → setState → re-render → effect runs → setState → ...
```

## The Three Usual Culprits

### 1. No dependency array at all

```jsx
useEffect(() => {
  setCount(count + 1);
}); // ❌ runs after EVERY render
```

Without a second argument, the effect runs after every render. If it sets state, that state change triggers another render, and the cycle never ends.

### 2. Depending on the state you're setting

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // ❌ count changes → effect runs → count changes → ...
```

### 3. Depending on a value that's "new" every render

Objects, arrays, and functions created inside the component body get a **new identity on every render**. React compares dependencies with `Object.is`, so `{} !== {}` and the effect sees a "change" every time.

## The Fixes

**Use an empty array if it should run once (on mount):**

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // ✅ runs once
```

**Use a functional update so you don't need the state as a dependency:**

```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(c => c + 1); // reads the latest value without depending on it
  }, 1000);
  return () => clearInterval(id);
}, []); // ✅
```

**List only the values that should actually re-trigger the effect:**

Here's a full, realistic example: fetching a user whenever `userId` changes.

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const options = { headers: { Accept: 'application/json' } };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/users/${userId}`, options)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true; // ignore stale responses if userId changes mid-request
    };
  }, [userId, options]);

  if (loading) return <p>Loading...</p>;
  return <h1>{user.name}</h1>;
}
```

## Quick Checklist

- Does the effect call a state setter? Make sure that state isn't in the dependency array, or use a functional update.
- Is every dependency a primitive, or a stable reference? For objects and functions, move them inside the effect, outside the component, or wrap them in `useMemo`/`useCallback`.
- Turn on the `eslint-plugin-react-hooks` rule `exhaustive-deps`. It catches many of these issues.

---

**Heads up:** there is exactly **one bug** hidden in the code above that would still cause an infinite loop. See if you can find it and fix it.

In your own words, what determines when a `useEffect` callback re-runs?

</details>

<details><summary>#4 pass · first token 6949ms · total 17246ms</summary>

# Fixing an infinite `useEffect` loop

An infinite loop almost always follows this cycle:

1. The component renders.
2. The effect runs and updates state.
3. The state update triggers a re-render.
4. React decides the effect needs to run again, so the cycle repeats.

To break the loop, you need to control **when React decides the effect should run again**. React makes that decision with the **dependency array**.

## The three main causes

### 1. No dependency array at all

```jsx
useEffect(() => {
  setCount(c => c + 1);
}); // ❌ runs after EVERY render
```

Without a dependency array, the effect runs after every single render. If it sets state, it loops forever.

### 2. Depending on the state you're setting

```jsx
useEffect(() => {
  setItems([...items, newItem]);
}, [items]); // ❌ setting items changes items, which re-runs the effect
```

**Fix:** Use a functional update so you don't need `items` as a dependency:

```jsx
useEffect(() => {
  setItems(prev => [...prev, newItem]);
}, [newItem]); // ✅
```

### 3. Objects, arrays, or functions in the dependency array

React compares dependencies with `Object.is`, which checks **reference equality**, not contents. An object, array, or function created inside your component body is a brand-new reference on every render. To React, it looks like it changed every time.

```jsx
const config = { limit: 10 };  // new object every render
useEffect(() => { /* ... */ }, [config]); // ❌
```

**Fixes:**
- Move the value outside the component if it's constant.
- Move it inside the effect.
- Wrap it in `useMemo` (for objects and arrays) or `useCallback` (for functions).
- Depend on primitive values instead, like `config.limit`.

## A complete example

Here is a component that fetches a user profile. It includes cleanup to avoid setting state after unmount, and it uses a functional update.

**There is exactly one bug in this code that will still cause an infinite loop.** See if you can find it.

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [fetchCount, setFetchCount] = useState(0);

  const fetchOptions = {
    headers: { Accept: 'application/json' },
  };

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/users/${userId}`, fetchOptions)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setUser(data);
          setFetchCount(c => c + 1);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, fetchOptions]);

  if (error) return <p>Error: {error.message}</p>;
  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>Fetched {fetchCount} time(s)</p>
    </div>
  );
}
```

**Hint:** Open your browser's Network tab and watch how many requests go out. Then compare each item in the dependency array against the three causes above.

## Debugging tips

- Add `console.log('effect ran')` inside the effect to confirm it's looping.
- Install `eslint-plugin-react-hooks`. The `exhaustive-deps` rule catches many of these issues automatically.
- React DevTools' "Highlight updates when components render" option lets you see re-renders as they happen.

---

In your own words, what determines whether React re-runs a `useEffect` after a render?

</details>

<details><summary>#5 pass · first token 10937ms · total 21230ms</summary>

# Stopping a `useEffect` Infinite Loop

An infinite loop almost always follows this cycle:

1. The component renders.
2. The effect runs and updates state.
3. The state change triggers a re-render.
4. The effect runs **again**, and the cycle repeats.

The fix is to control **when** the effect re-runs, using the dependency array.

## The Three Common Causes

### 1. No dependency array at all

```jsx
useEffect(() => {
  setCount(count + 1); // runs after EVERY render
});
```

Without a second argument, the effect runs after every render. Add an array:

```jsx
useEffect(() => {
  // runs once, after the first render
}, []);
```

### 2. Setting state that is also a dependency

```jsx
useEffect(() => {
  setCount(count + 1);
}, [count]); // count changes → effect runs → count changes → ...
```

Use a **functional update** so you don't need to read the state, and remove it from the array:

```jsx
useEffect(() => {
  setCount(prev => prev + 1);
}, []);
```

### 3. Objects, arrays, or functions as dependencies

React compares dependencies by **reference**, not by content. Something like `{}`, `[]`, or `() => {}` written in the component body is a *new* value on every render, so the effect thinks it changed.

```jsx
const options = { method: 'GET' };      // new object every render
useEffect(() => { /* ... */ }, [options]); // runs every render
```

Fixes:
- Move the object or function **inside** the effect, or
- Stabilize it with `useMemo` (for values) or `useCallback` (for functions).

## A Full Example

Here's a component that fetches a user and merges the result into existing state, using everything above:

```jsx
import { useState, useEffect, useCallback } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState({});
  const [error, setError] = useState(null);

  // Stabilize the function so it isn't recreated on every render
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();
      setUser({ ...user, ...data });
    } catch (err) {
      setError(err);
    }
  }, [userId, user]);

  // Re-run only when fetchUser changes
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (error) return <p>Something went wrong.</p>;
  return <h1>{user.name ?? 'Loading...'}</h1>;
}
```

**Heads up: this example contains exactly one bug, and it causes the very problem you're trying to fix.** Trace the render cycle step by step (render → effect → state update → re-render) and look for where it fails to stop. The three causes above are your hints.

## Debugging Checklist

- Put a `console.log` inside the effect. If it floods the console, you've confirmed the loop.
- Turn on the `react-hooks/exhaustive-deps` ESLint rule. It flags missing dependencies. When it asks you to add a dependency that would cause a loop, that usually means you should restructure, for example with a functional update.
- For each dependency, ask: *Does this change every render? Does the effect itself change it?*

In your own words, what determines whether a `useEffect` runs again after a render?

</details>

### L4: 5/5

<details><summary>#1 pass · first token 1062ms · total 13901ms</summary>

An infinite `useEffect` loop almost always happens because **the effect updates something that's in its own dependency array** (or it has no dependency array at all), so each render triggers the effect, which triggers another render, and so on.

Here are the common causes and how to fix each.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, so it loops forever
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
});
```

**Fix:** Add a dependency array. Use `[]` to run once on mount:

```jsx
// ✅ Runs once after the first render
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

---

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes, effect runs, count changes again...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Ask whether you need an effect at all. If you do, use the functional updater so you don't depend on the value:

```jsx
// ✅ No longer depends on count
useEffect(() => {
  setCount(c => c + 1);
}, []);
```

---

## 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is` (reference equality). A new object, array, or function is created on every render, so it's "different" every time:

```jsx
// ❌ options is a new object each render, so the effect runs every render
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
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

The same applies to functions. Wrap them in `useCallback`, or define them inside the effect:

```jsx
// ❌ fetchUser is recreated every render
const fetchUser = () => api.get(`/users/${id}`).then(setUser);
useEffect(() => { fetchUser(); }, [fetchUser]);

// ✅ Define it inside the effect
useEffect(() => {
  const fetchUser = () => api.get(`/users/${id}`).then(setUser);
  fetchUser();
}, [id]);

// ✅ Or use useCallback
const fetchUser = useCallback(
  () => api.get(`/users/${id}`).then(setUser),
  [id]
);
useEffect(() => { fetchUser(); }, [fetchUser]);
```

---

## 4. Props from a parent that change every render

If a parent passes `options={{...}}` or `onChange={() => ...}` inline, the child's effect will re-run constantly. Fix it in the **parent** with `useMemo`/`useCallback`, or have the child depend on primitive fields (`props.options.id`) instead of the whole object.

---

## 5. You might not need an effect at all

Many loops come from using an effect to compute derived data:

```jsx
// ❌ Unnecessary effect + extra render
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// ✅ Just compute it during render
const fullName = `${first} ${last}`;
```

For expensive calculations, use `useMemo` instead of effect + state.

---

## Debugging checklist

1. **Does the effect have a dependency array?** If not, add one.
2. **Does it set any state that's listed in its dependencies?** Use the functional updater or rethink the logic.
3. **Are any dependencies objects, arrays, or functions?** Stabilize them with `useMemo`/`useCallback`, move them inside the effect, or use primitives.
4. **Is the effect just deriving data?** Compute it during render instead.
5. **Install `eslint-plugin-react-hooks`.** The `exhaustive-deps` rule flags many of these problems. Don't silence it; fix the underlying cause.

**Note:** In React 18+ Strict Mode (development only), effects intentionally run **twice** on mount. That's not an infinite loop. It's React checking that your cleanup works. It won't happen in production.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#2 pass · first token 1750ms · total 14504ms</summary>

An infinite `useEffect` loop almost always means this cycle is happening:

**effect runs → updates state → component re-renders → effect runs again → …**

Here are the common causes and how to fix each.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render
useEffect(() => {
  setCount(count + 1);
});
```

Without a dependency array, the effect runs after every render. Since it sets state, it triggers another render, and the loop never ends.

```jsx
// ✅ Runs once, after the first render
useEffect(() => {
  fetchData();
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

**Fix:** Use a functional update so you don't need the state in the dependency array:

```jsx
// ✅
useEffect(() => {
  setCount(prev => prev + 1);
}, []); // runs once
```

Or reconsider whether this belongs in an effect at all. Derived values can often just be computed during render:

```jsx
// ✅ No effect or extra state needed
const doubled = count * 2;
```

---

## 3. Objects, arrays, or functions as dependencies

This is the sneakiest cause. React compares dependencies with `Object.is` (reference equality), and objects, arrays, and functions are **recreated on every render**, so they're always "different."

```jsx
function MyComponent() {
  const options = { page: 1 };          // new object every render
  const fetchData = () => { /* ... */ }; // new function every render

  useEffect(() => {
    fetchData().then(setData);           // setData → re-render → new options/fetchData
  }, [options, fetchData]);              // ❌ always "changed"
}
```

**Fixes (pick one):**

**a) Move it inside the effect**
```jsx
useEffect(() => {
  const options = { page: 1 };
  const fetchData = async () => { /* uses options */ };
  fetchData().then(setData);
}, []); // ✅
```

**b) Move it outside the component** (if it doesn't depend on props or state)
```jsx
const options = { page: 1 };

function MyComponent() {
  useEffect(() => { /* uses options */ }, []); // ✅
}
```

**c) Depend on primitives instead of the whole object**
```jsx
useEffect(() => {
  fetchUser(user.id);
}, [user.id]); // ✅ instead of [user]
```

**d) Memoize with `useMemo` / `useCallback`**
```jsx
const options = useMemo(() => ({ page }), [page]);
const fetchData = useCallback(async () => {
  const res = await fetch(`/api?page=${page}`);
  return res.json();
}, [page]);

useEffect(() => {
  fetchData().then(setData);
}, [fetchData]); // ✅ only changes when page changes
```

---

## 4. Props that are recreated by the parent

If a parent passes an inline object or function, it's new on every parent render:

```jsx
// Parent
<Child config={{ theme: 'dark' }} onLoad={() => console.log('hi')} />

// Child
useEffect(() => { onLoad(); }, [onLoad]); // ❌ runs every parent render
```

**Fix:** Memoize in the parent with `useMemo` / `useCallback`, or depend on primitive values in the child.

---

## Debugging checklist

1. **Does the effect have a dependency array?** If not, add one.
2. **Does the effect set state that's in the dependency array?** Use a functional update or restructure.
3. **Are any dependencies objects, arrays, or functions?** Stabilize them with one of the fixes above.
4. **Do you need the effect at all?** Effects are for syncing with *external* systems (APIs, subscriptions, the DOM). If you're just transforming data, compute it during render instead.

A quick way to find the culprit is to log the dependencies:
```jsx
useEffect(() => {
  console.log('effect ran', { options, fetchData });
}, [options, fetchData]);
```

---

## Note: StrictMode is not a loop

In development, React's `<StrictMode>` intentionally runs effects **twice** on mount to help you catch missing cleanup. If your effect runs exactly twice and then stops, that's expected. It doesn't happen in production.

---

If you share your actual `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#3 pass · first token 1919ms · total 14503ms</summary>

An infinite `useEffect` loop almost always happens because **the effect updates something that causes a re-render, and that re-render makes the effect run again.** Here are the common causes and their fixes.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, so it loops forever
useEffect(() => {
  fetchData().then(setData);
});
```

**Fix:** Add a dependency array.

```jsx
// ✅ Runs once on mount
useEffect(() => {
  fetchData().then(setData);
}, []);
```

---

## 2. Setting state that's also a dependency

```jsx
// ❌ count changes, effect runs, count changes, effect runs...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use a functional update so you don't need the state in the deps, or rethink whether this belongs in an effect at all.

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

## 3. Objects, arrays, or functions as dependencies

This is the most confusing cause. Objects, arrays, and functions are **recreated on every render**, so React sees a "new" value each time (it compares with `Object.is`, i.e., by reference).

```jsx
function MyComponent() {
  const options = { page: 1 };          // new object every render
  const fetchItems = () => { /* ... */ }; // new function every render

  // ❌ Both deps "change" every render
  useEffect(() => {
    fetchItems(options).then(setItems);
  }, [options, fetchItems]);
}
```

**Fixes (pick one):**

**a) Move it inside the effect** (simplest):
```jsx
useEffect(() => {
  const options = { page: 1 };
  fetchItems(options).then(setItems);
}, []);
```

**b) Depend on primitive values instead:**
```jsx
useEffect(() => {
  fetchItems({ page }).then(setItems);
}, [page]); // page is a number, so it compares by value
```

**c) Memoize with `useMemo` / `useCallback`:**
```jsx
const options = useMemo(() => ({ page }), [page]);
const fetchItems = useCallback((opts) => api.get(opts), []);

useEffect(() => {
  fetchItems(options).then(setItems);
}, [options, fetchItems]);
```

**d) Move it outside the component** if it doesn't depend on props or state:
```jsx
const DEFAULT_OPTIONS = { page: 1 };

function MyComponent() {
  useEffect(() => { /* use DEFAULT_OPTIONS */ }, []);
}
```

---

## 4. Props that are objects or functions from the parent

If a parent passes `onChange={() => ...}` or `config={{...}}`, it's a new reference on every parent render. Fix it in the **parent** with `useCallback` / `useMemo`, or depend on specific primitive fields (`config.id`) in the child.

---

## 5. Fetching and setting the same state

```jsx
// ❌ setUser creates a new object, so the effect runs again
useEffect(() => {
  api.getUser(id).then(setUser);
}, [user]);
```

**Fix:** Depend on what *triggers* the fetch (`id`), not the result (`user`).

```jsx
useEffect(() => {
  api.getUser(id).then(setUser);
}, [id]);
```

---

## Debugging tips

- **Log the deps** to see which one changes:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { options, fetchItems });
  }, [options, fetchItems]);
  ```
- Enable the **`eslint-plugin-react-hooks`** `exhaustive-deps` rule. It flags missing deps and often suggests the right fix.
- **Don't silence the linter** by removing deps. That trades the infinite loop for stale-data bugs.
- **Note:** In development with `<StrictMode>`, React 18+ intentionally runs effects **twice** on mount. That's expected behavior, not an infinite loop.

---

## Quick checklist

1. Do you have a dependency array at all?
2. Does the effect set state that's listed in its own deps?
3. Are any deps objects, arrays, or functions created during render?
4. Can you depend on a primitive (ID, string, number) instead?
5. Do you even need an effect? Derived values can often just be computed during render.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#4 pass · first token 1942ms · total 13178ms</summary>

An infinite `useEffect` loop happens when the effect **updates something that causes a re-render, and that re-render triggers the effect again**. Here are the common causes and their fixes.

---

## 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. setData causes a render, which runs the effect again.
useEffect(() => {
  fetchData().then(setData);
});
```

**Fix:** Add a dependency array.

```jsx
// ✅ Runs once on mount
useEffect(() => {
  fetchData().then(setData);
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

**Fix:** Use a functional update so you don't need the state as a dependency, or reconsider whether this belongs in an effect at all.

```jsx
// ✅
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

---

## 3. Objects, arrays, or functions as dependencies

JavaScript compares these **by reference**, and they're recreated on every render. So React sees a "new" value each time.

```jsx
// ❌ `options` is a new object every render
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
}, [id]); // ✅ id is a string/number
```

**b) Move the object inside the effect**
```jsx
useEffect(() => {
  const options = { userId: id };
  fetchUser(options).then(setUser);
}, [id]);
```

**c) Memoize it with `useMemo`**
```jsx
const options = useMemo(() => ({ userId: id }), [id]);

useEffect(() => {
  fetchUser(options).then(setUser);
}, [options]);
```

---

## 4. Functions as dependencies

```jsx
// ❌ loadData is recreated every render
const loadData = () => fetchData(id).then(setData);

useEffect(() => {
  loadData();
}, [loadData]);
```

**Fix:** Wrap it in `useCallback`, or define it inside the effect.

```jsx
// ✅ Option A
const loadData = useCallback(() => {
  fetchData(id).then(setData);
}, [id]);

useEffect(() => {
  loadData();
}, [loadData]);

// ✅ Option B (often simpler)
useEffect(() => {
  const loadData = () => fetchData(id).then(setData);
  loadData();
}, [id]);
```

---

## 5. Props that are new objects/functions from the parent

If a parent passes `onChange={() => ...}` or `config={{...}}` inline, the child gets a new reference every render. Fix it in the parent with `useCallback` / `useMemo`, or have the child depend on specific primitive fields.

---

## Debugging tips

- **Log the dependencies** to see which one keeps changing:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { a, b, c });
  }, [a, b, c]);
  ```
- **Enable the ESLint rule** `react-hooks/exhaustive-deps`. It warns about missing dependencies and helps you avoid stale values. Don't silence it to "fix" a loop. Fix the unstable dependency instead.
- **Ask whether you need an effect at all.** If you're computing a value from props/state, just calculate it during render (or with `useMemo`) instead of storing it in state via an effect. See React's guide ["You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect).

---

**Note:** In development with React 18+ Strict Mode, effects intentionally run **twice** on mount. That's not an infinite loop. It only happens in dev, to help catch missing cleanup.

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.

</details>

<details><summary>#5 pass · first token 1105ms · total 11913ms</summary>

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array** (or it has no dependency array at all). Each render triggers the effect, the effect triggers a re-render, and so on.

Here are the most common causes and their fixes.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render, and setData causes a render
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
```

**Fixes:**
- Ask whether this needs to be an effect at all. Derived values can often be computed during render.
- If you only need the previous value, use the functional updater and drop the dependency:

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // no longer depends on count
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is`. A new object, array, or function is created on every render, so it's "different" every time.

```jsx
// ❌ options is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchItems(options).then(setItems);
}, [options]);
```

**Fixes (pick one):**

```jsx
// a) Depend on primitive values instead
useEffect(() => {
  fetchItems({ page }).then(setItems);
}, [page]);

// b) Move the object inside the effect
useEffect(() => {
  const options = { page: 1 };
  fetchItems(options).then(setItems);
}, []);

// c) Memoize it
const options = useMemo(() => ({ page }), [page]);

// d) For functions, use useCallback (or define them inside the effect)
const loadItems = useCallback(() => fetchItems({ page }), [page]);
useEffect(() => {
  loadItems().then(setItems);
}, [loadItems]);
```

---

### 4. Props from a parent that change every render

If a parent passes `onChange={() => ...}` or `filters={{...}}` inline, the child's effect sees a new value each time. Fix it in the parent with `useCallback` / `useMemo`, or depend on primitive fields in the child.

---

### 5. Guard the update

If you must set state based on a dependency, only update when the value actually differs:

```jsx
useEffect(() => {
  const next = compute(input);
  if (next !== value) setValue(next);
}, [input, value]);
```

---

### Debugging tips

- **Enable the ESLint rule `react-hooks/exhaustive-deps`.** Don't silence it. Restructure the code instead.
- Log which dependency is changing:
  ```jsx
  useEffect(() => { console.log('effect ran', { a, b, c }); }, [a, b, c]);
  ```
- Ask yourself: *"Does this need to be an effect?"* Computing values from props/state, or reacting to a user event, usually belongs in render logic or an event handler, not `useEffect`. (See the React docs page **"You Might Not Need an Effect."**)

If you share your specific effect code, I can point out exactly what's causing the loop.

</details>

### Demo answer graded against each L1 reply above

- #1: correct 0.85: The student accurately explains that the dependency array controls when the effect re-runs, triggering only when a listed value changes, with an empty array meaning once after mount, which is the core mechanism at this level.
- #2: correct 0.88: The student correctly explains that the dependency array determines when the effect re-runs, rerunning only when listed values change and running once after mount when empty, which is the core mechanism at this level.
- #3: correct 0.88: The student correctly explains that React compares the values in the dependency array after each render and re-runs the effect only when one of them changes, with an empty array meaning it runs once after mount, which is enough at this level even though they don't spell out the case of omitting the array.
- #4: correct 0.85: The student correctly explains that the dependency array controls re-running by comparing listed values for changes, and that an empty array means the effect runs once after mount, which is the core mechanism at this level.
- #5: correct 0.88: The student accurately explains that React re-runs an effect only when a value in its dependency array changes, and that an empty array means it runs once after mount, which is the core mechanism at this level.

## Grading

| case | level | expected | got | confidence | new_level | time | rationale |
|---|---|---|---|---|---|---|---|
| demo correctAnswer | L1 | correct | correct | 0.93 | L4 | 4988ms | The student correctly explains that the dependency array tells React to re-run the effect only when a listed value changes, and that an empty array means it runs once after mount, which is enough at this level. |
| demo lazyAnswer at L3 | L3 | lazy | lazy | 0.97 | L2 | 3351ms | The student asked for code without engaging with the question about what the dependency array tells React. |
| partial | L1 | partial | partial | 0.85 | L1 | 5162ms | The student correctly identifies the dependency array as the second argument and says it controls the effect, but never explains that it tells React to re-run the effect only when the listed values change. |
| incorrect | L1 | incorrect | incorrect | 0.93 | L1 | 2052ms | The student thinks the dependency array controls which state the effect may modify, when in fact it lists the values React watches to decide when the effect should re-run. |
| not_an_answer | L1 | not_an_answer | not_an_answer | 0.97 | L1 | 2257ms | The student asked an unrelated CSS question instead of explaining what the dependency array tells React. |

## Classify (LLM fallback)

| prompt | expected | got | method | confidence | time |
|---|---|---|---|---|---|
| How can I share the current theme with deeply nested parts of my app without handing it down manually at every level? | Context API | Context API | llm | 0.95 | 813ms |
| Why does my list re-render every time its parent does, even when its data did not change? | Performance & Memoization | Performance & Memoization | llm | 0.90 | 1436ms |
| write a haiku about autumn leaves | null | null | none | 0.00 | 1410ms |

## Parse (`fixtures/demo-syllabus.md`)

### text: CSE 134R — React Fundamentals (9630ms)

- **Foundations**
  - `n1` JSX & Components · L3 minor · code · [jsx, createelement, function component, component, babel, fragment] · deps []  
    Explains what JSX compiles to (React.createElement / jsx calls) and decomposes a UI mockup into reusable components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback prop, prop types] · deps [n1]  
    Passes data and callbacks through props, uses the children prop, and explains one-way data flow
  - `n3` State with useState · L4 major · refresh · [usestate, setstate, functional update, state not updating, re-render, batching] · deps [n2]  
    Uses useState correctly, including functional updates, and explains why state updates are asynchronous
- **Effects & Data**
  - `n4` React useEffect · L4 major · zap · [useeffect, dependency array, cleanup function, infinite loop, too many re-renders, side effect] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array, and writes correct cleanup functions
  - `n5` Data Fetching · L3 minor · download · [fetch, loading state, error state, race condition, abortcontroller, async useeffect] · deps [n4]  
    Fetches data inside an effect with loading and error states and prevents race conditions using cleanup or AbortController
  - `n6` Custom Hooks · L3 minor · hook · [custom hook, rules of hooks, use prefix, invalid hook call, reusable logic] · deps [n4]  
    Extracts reusable stateful logic into a custom hook and explains the rules of hooks
- **Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, provider, prop drilling, global state] · deps [n3]  
    Provides and consumes shared state with createContext/useContext and justifies when context beats prop drilling
  - `n8` Performance & Memoization · L4 major · cpu · [react.memo, usememo, usecallback, unnecessary re-renders, memoization, referential equality] · deps [n6, n7]  
    Diagnoses unnecessary re-renders and fixes them appropriately with React.memo, useMemo, or useCallback

### pdf: CSE 134R - React Fundamentals (9833ms)

- **Module 1 - Foundations**
  - `n1` JSX & Components · L3 major · code · [jsx, react.createelement, function component, component tree, fragment, return jsx] · deps []  
    Explains what JSX compiles to (React.createElement / jsx function calls) and decomposes a UI mockup into reusable components
  - `n2` Props · L3 minor · arrow-down · [props, children prop, one-way data flow, callback prop, prop drilling, destructuring props] · deps [n1]  
    Passes data and callbacks through props and explains one-way data flow, including use of the children prop
  - `n3` State with useState · L3 major · box · [usestate, setstate, functional update, state not updating, stale state, re-render] · deps [n2]  
    Uses useState correctly, including functional updates, and explains why state updates are asynchronous
- **Module 2 - Effects & Data**
  - `n4` React useEffect · L4 major · refresh · [useeffect, dependency array, cleanup function, infinite loop, too many re-renders, side effect] · deps [n3]  
    Identifies and prevents an infinite render loop caused by a missing or wrong dependency array, and writes correct cleanup functions
  - `n5` Data Fetching · L3 minor · download · [fetch, async useeffect, loading state, race condition, abortcontroller, error handling] · deps [n4]  
    Fetches data inside an effect with loading and error states and prevents race conditions using cleanup or AbortController
  - `n6` Custom Hooks · L4 major · hook · [custom hook, rules of hooks, use prefix, hook called conditionally, reusable logic, invalid hook call] · deps [n4]  
    Extracts reusable stateful logic into a custom hook and explains the rules of hooks
- **Module 3 - Building Apps**
  - `n7` Context API · L3 minor · share · [createcontext, usecontext, context provider, prop drilling, global state, provider value] · deps [n3]  
    Uses createContext and useContext to share state and justifies when context is preferable to prop drilling
  - `n8` Performance & Memoization · L4 major · zap · [react.memo, usememo, usecallback, unnecessary re-renders, referential equality, memoization] · deps [n6, n7]  
    Diagnoses unnecessary re-renders and applies React.memo, useMemo, and useCallback appropriately

## 3-turn sandbox exchange

**Student (L1):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 884ms):**

Infinite `useEffect` loops usually come down to *when* React decides to run your effect.

**Hint:** Look at what happens inside your effect. Does it update state? A state update causes a re-render, so ask yourself what React checks after each render to decide whether to run the effect again. That second argument you pass to `useEffect` (or leave out) is where to look.

In your own words, what determines when a `useEffect` runs again after a render?

**Student (graded correct 0.88 → L4: The student accurately explains that React re-runs an effect only when a value in the dependency array changes and that an empty array runs it once after mount, which is the core mechanism at this level.):**

The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.

**Claude (first token 1613ms):**

Exactly right. React compares each dependency to its value from the previous render (using `Object.is`), and only re-runs the effect if something changed. With **no array at all**, the effect runs after *every* render.

## The three common causes and fixes

### 1. Missing dependency array

```jsx
// ❌ Runs after every render -> setData triggers render -> runs again...
useEffect(() => {
  fetch('/api/items').then(r => r.json()).then(setData);
});

// ✅ Runs once after mount
useEffect(() => {
  fetch('/api/items').then(r => r.json()).then(setData);
}, []);
```

### 2. The effect updates a value it depends on

```jsx
// ❌ count changes -> effect runs -> count changes -> ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

Fix: ask whether this belongs in an effect at all. If it's derived from other state, compute it during render instead. If you really need to update based on the previous value, use the functional updater so you don't need `count` as a dependency:

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // runs once
```

### 3. Objects, arrays, or functions as dependencies

This one is the sneakiest. These are **recreated on every render**, so they're never `Object.is`-equal to the previous version, even if their contents are identical.

```jsx
function List({ userId }) {
  const options = { userId };           // new object every render
  const load = () => fetchItems(options); // new function every render

  useEffect(() => {
    load().then(setItems);  // setItems -> re-render -> new `load` -> effect again
  }, [load]);
}
```

Fixes, in order of preference:

```jsx
// ✅ a) Depend on primitives, and create objects inside the effect
useEffect(() => {
  fetchItems({ userId }).then(setItems);
}, [userId]);

// ✅ b) Memoize when the object/function must live outside the effect
const options = useMemo(() => ({ userId }), [userId]);
const load = useCallback(() => fetchItems(options), [options]);

useEffect(() => {
  load().then(setItems);
}, [load]);
```

## Quick debugging checklist

1. **Is there a dependency array?** If not, add one.
2. **Does the effect set state that's also in the array?** Use a functional updater, or reconsider the design.
3. **Are any dependencies objects, arrays, or functions defined in the component body?** Move them inside the effect, depend on primitive values, or wrap them in `useMemo`/`useCallback`.
4. **Enable the `react-hooks/exhaustive-deps` ESLint rule.** It catches missing dependencies and warns when a dependency changes on every render.

**Don't** "fix" a loop by deleting real dependencies from the array to silence it. That trades an infinite loop for stale-data bugs. Fix the *reason* the dependency keeps changing instead.

If you share the specific effect that's looping, I can point to which of these is causing it.

**Student, new chat (L4, no block):**

How do I stop my useEffect from running in an infinite loop?

**Claude (first token 1152ms):**

An infinite `useEffect` loop almost always means **the effect updates something that's in its own dependency array** (or it has no dependency array at all). The effect runs, changes state, the component re-renders, the dependency looks "changed," and the effect runs again.

Here are the common causes and their fixes.

---

### 1. Missing dependency array

```jsx
// ❌ Runs after EVERY render. Setting state causes a render, so it runs forever.
useEffect(() => {
  setCount(count + 1);
});
```

**Fix:** Add a dependency array. Use `[]` to run only once on mount:

```jsx
useEffect(() => {
  fetchData();
}, []); // runs once after the first render
```

---

### 2. Setting state that's also a dependency

```jsx
// ❌ count changes → effect runs → count changes → ...
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

**Fix:** Use the functional updater so you don't need the state as a dependency, or rethink whether this belongs in an effect at all:

```jsx
useEffect(() => {
  setCount(c => c + 1);
}, []); // no longer depends on count
```

---

### 3. Objects, arrays, or functions as dependencies

React compares dependencies with `Object.is` (reference equality). Objects, arrays, and functions created during render are **new every render**, so they always look "changed."

```jsx
// ❌ `options` is a new object every render
const options = { page: 1 };
useEffect(() => {
  fetchData(options).then(setData); // setData triggers re-render → new options → loop
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
useEffect(() => {
  fetchData(options).then(setData);
}, [options]);
```

Same idea for functions, using `useCallback`:

```jsx
// ❌ fetchUser is recreated every render
const fetchUser = () => api.get(`/users/${id}`);

// ✅ stable reference unless `id` changes
const fetchUser = useCallback(() => api.get(`/users/${id}`), [id]);

useEffect(() => {
  fetchUser().then(setUser);
}, [fetchUser]);
```

Often the simplest option is to define the function **inside** the effect.

---

### 4. Data fetching that stores a new object every time

```jsx
// ❌ setData always stores a new array, and data is a dependency
useEffect(() => {
  fetch('/api/items').then(r => r.json()).then(setData);
}, [data]);
```

**Fix:** Depend on what should *trigger* the fetch (an ID, a query, etc.), not on the result:

```jsx
useEffect(() => {
  fetch(`/api/items?q=${query}`).then(r => r.json()).then(setData);
}, [query]);
```

---

### 5. You may not need an effect at all

If you're computing state from other state or props, just compute it during render:

```jsx
// ❌ Unnecessary effect + extra render
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// ✅ Derive it directly
const fullName = `${first} ${last}`;
```

---

### Debugging tips

- **Install `eslint-plugin-react-hooks`** and enable `exhaustive-deps`. It flags missing or unstable dependencies.
- **Find which dependency is changing** by logging inside the effect:
  ```jsx
  useEffect(() => {
    console.log('effect ran', { dep1, dep2 });
  }, [dep1, dep2]);
  ```
- **Don't silence the linter** by removing real dependencies. That causes stale-data bugs. Stabilize the dependency instead.
- **Note:** In development, React 18+ Strict Mode runs effects **twice** on mount on purpose. That's expected and isn't an infinite loop.

---

If you share your specific `useEffect` code, I can point out exactly what's causing the loop.
