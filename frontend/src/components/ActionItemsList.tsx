import React from 'react';

interface ActionItem {
  task: string;
  assignee?: string;
  due_date?: string;
  status: 'pending' | 'completed';
}

interface Props {
  items: ActionItem[];
}

export const ActionItemsList: React.FC<Props> = ({ items }: Props) => {
  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-bold mb-2">Action Items</h2>
      <ul className="space-y-2">
        {items.map((item: ActionItem, index: number) => (
          <li key={index} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.task}</p>
              {item.assignee && <p className="text-sm">Assignee: {item.assignee}</p>}
              {item.due_date && <p className="text-sm">Due: {item.due_date}</p>}
            </div>
            <span className={`px-2 py-1 rounded-full text-sm ${
              item.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {item.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}; 