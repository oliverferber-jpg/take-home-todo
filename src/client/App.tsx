import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Priority, Todo, todoApi } from "./api";

type Filter = "all" | "active" | "completed";

const priorityLabel: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High"
};

const priorityOrder: Priority[] = ["LOW", "MEDIUM", "HIGH"];

const dateForInput = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const formatDueDate = (value: string | null) => {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );
};

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const groupedTodos = useMemo(
    () =>
      [...todos].sort((first, second) => {
        if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      }),
    [todos]
  );

  const loadTodos = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setIsLoading(true);
        const nextTodos = await todoApi.list(filter);
        setTodos(nextTodos);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load todos");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type: string };
      if (message.type === "todos:changed") {
        void loadTodos(false);
      }
    };

    return () => events.close();
  }, [loadTodos]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setEditingId(null);
  };

  const submitTodo = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : null
    };

    try {
      if (editingId) {
        const updated = await todoApi.update(editingId, payload);
        setTodos((current) => current.map((todo) => (todo.id === updated.id ? updated : todo)));
      } else {
        const created = await todoApi.create(payload);
        setTodos((current) => [created, ...current]);
      }
      resetForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save todo");
    }
  };

  const toggleTodo = async (todo: Todo) => {
    const previous = todos;
    setTodos((current) => current.map((item) => (item.id === todo.id ? { ...item, completed: !item.completed } : item)));

    try {
      const updated = await todoApi.update(todo.id, { completed: !todo.completed });
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (nextError) {
      setTodos(previous);
      setError(nextError instanceof Error ? nextError.message : "Unable to update todo");
    }
  };

  const deleteTodo = async (id: string) => {
    const previous = todos;
    setTodos((current) => current.filter((todo) => todo.id !== id));

    try {
      await todoApi.remove(id);
    } catch (nextError) {
      setTodos(previous);
      setError(nextError instanceof Error ? nextError.message : "Unable to delete todo");
    }
  };

  const editTodo = (todo: Todo) => {
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setPriority(todo.priority);
    setDueDate(dateForInput(todo.dueDate));
    setEditingId(todo.id);
  };

  const clearCompleted = async () => {
    try {
      await todoApi.clearCompleted();
      setTodos((current) => current.filter((todo) => !todo.completed));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to clear completed todos");
    }
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="panel compose-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PostgreSQL backed</p>
              <h1>Todo Command Center</h1>
            </div>
            <div className="counts" aria-label="Todo counts">
              <span>{activeCount} active</span>
              <span>{completedCount} done</span>
            </div>
          </div>

          <form className="todo-form" onSubmit={submitTodo}>
            <label>
              <span>Task</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ship the take-home"
                maxLength={120}
              />
            </label>

            <label>
              <span>Notes</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add context, acceptance criteria, or reminders"
                maxLength={500}
              />
            </label>

            <div className="form-row">
              <label>
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                  {priorityOrder.map((item) => (
                    <option key={item} value={item}>
                      {priorityLabel[item]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Due</span>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {editingId ? "Save changes" : "Add todo"}
              </button>
              {editingId ? (
                <button className="ghost-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="panel list-panel">
          <div className="toolbar">
            <div className="segmented" aria-label="Filter todos">
              {(["all", "active", "completed"] as Filter[]).map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  type="button"
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button className="ghost-button" type="button" onClick={clearCompleted} disabled={completedCount === 0}>
              Clear done
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="todo-list" aria-live="polite">
            {isLoading ? <p className="empty-state">Loading todos...</p> : null}
            {!isLoading && groupedTodos.length === 0 ? <p className="empty-state">No todos match this view.</p> : null}
            {groupedTodos.map((todo) => (
              <article className={`todo-item ${todo.completed ? "completed" : ""}`} key={todo.id}>
                <button
                  className="check-button"
                  type="button"
                  aria-label={todo.completed ? "Mark active" : "Mark completed"}
                  onClick={() => void toggleTodo(todo)}
                >
                  {todo.completed ? "✓" : ""}
                </button>

                <div className="todo-content">
                  <div className="todo-title-row">
                    <h2>{todo.title}</h2>
                    <span className={`priority priority-${todo.priority.toLowerCase()}`}>
                      {priorityLabel[todo.priority]}
                    </span>
                  </div>
                  {todo.description ? <p>{todo.description}</p> : null}
                  <span className="due-date">{formatDueDate(todo.dueDate)}</span>
                </div>

                <div className="item-actions">
                  <button className="text-button" type="button" onClick={() => editTodo(todo)}>
                    Edit
                  </button>
                  <button className="text-button danger" type="button" onClick={() => void deleteTodo(todo.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
