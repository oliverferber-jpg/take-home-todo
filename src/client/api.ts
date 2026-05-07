export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type Todo = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodoInput = {
  title: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: string | null;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => undefined);
    throw new Error(detail?.message ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const todoApi = {
  list: (status: "all" | "active" | "completed") => request<Todo[]>(`/api/todos?status=${status}`),
  create: (todo: TodoInput) =>
    request<Todo>("/api/todos", {
      method: "POST",
      body: JSON.stringify(todo)
    }),
  update: (id: string, todo: Partial<TodoInput & { completed: boolean }>) =>
    request<Todo>(`/api/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(todo)
    }),
  remove: (id: string) =>
    request<void>(`/api/todos/${id}`, {
      method: "DELETE"
    }),
  clearCompleted: () =>
    request<{ deleted: number }>("/api/todos", {
      method: "DELETE"
    })
};
