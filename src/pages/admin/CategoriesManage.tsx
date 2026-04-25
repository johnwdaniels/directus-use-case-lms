import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createCategory, deleteCategory, fetchAdminCategories, updateCategory } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>{children}</li>;
}

export default function CategoriesManage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<UnknownRecord>({ name: '', slug: '', parent: null });
  const [editing, setEditing] = useState<UnknownRecord | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const q = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const rows = (q.data ?? []) as UnknownRecord[];
  const ids = useMemo(() => rows.map((r) => String(r.id)), [rows]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing?.id) return updateCategory(String(editing.id), form);
      return createCategory(form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-categories'] });
      setForm({ name: '', slug: '', parent: null });
      setEditing(null);
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });
  const reorderMut = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: UnknownRecord }) => updateCategory(id, payload), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-categories'] }) });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(rows, oldIndex, newIndex);
    moved.forEach((row, index) => {
      reorderMut.mutate({ id: String(row.id), payload: { sort_order: index, parent: null } });
    });
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Manage categories</h1>
        <p className="mt-1 text-sm text-slate-600">Drag rows to reorder. Use parent selector to move under another category.</p>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">{editing ? 'Edit category' : 'Add category'}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={String(form.name ?? '')} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Slug" value={String(form.slug ?? '')} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
            <select className="rounded-lg border px-3 py-2 text-sm" value={String(form.parent ?? '')} onChange={(e) => setForm((s) => ({ ...s, parent: e.target.value || null }))}>
              <option value="">No parent</option>
              {rows.map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.name ?? '')}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => saveMut.mutate()}>{editing ? 'Save' : '+ Add category'}</button>
            {editing ? <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setEditing(null); setForm({ name: '', slug: '', parent: null }); }}>Cancel</button> : null}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <SortableRow key={String(row.id)} id={String(row.id)}>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{String(row.name ?? '')}</p>
                        <p className="text-xs text-slate-500">parent: {typeof row.parent === 'object' ? String((row.parent as UnknownRecord).id ?? '') : String(row.parent ?? 'none')}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditing(row); setForm({ name: row.name, slug: row.slug, parent: typeof row.parent === 'object' ? (row.parent as UnknownRecord).id : row.parent ?? null }); }}>Edit</button>
                        <a className="rounded border px-2 py-1 text-xs" href={`/categories/${encodeURIComponent(String(row.slug ?? ''))}`}>View courses</a>
                        <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => { if (confirm('Delete category?')) delMut.mutate(String(row.id)); }}>Delete</button>
                      </div>
                    </div>
                  </SortableRow>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </AdminGate>
  );
}
