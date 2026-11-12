export const departments = ["Engineering", "Design", "Sales", "Support"] as const;
export const statuses = ["active", "pending", "inactive"] as const;

export type Department = (typeof departments)[number];
export type Status = (typeof statuses)[number];

export interface Employee {
  id: number;
  name: string;
  email: string;
  department: Department;
  salary: number;
  rating: number; // 0 to 5
  progress: number; // 0 to 100
  status: Status;
  joined: string;
}

const first = ["Amina", "Brian", "Carol", "David", "Esther", "Felix", "Grace", "Henry", "Irene", "Joseph", "Kevin", "Lydia"];
const last = ["Okello", "Mugisha", "Nankya", "Ssemakula", "Achieng", "Kato", "Namuli", "Opio"];

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Deterministic sample data, so the demos look the same on every load. */
export function makeEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => {
    const f = first[i % first.length];
    const l = last[(i * 3) % last.length];
    return {
      id: i + 1,
      name: `${f} ${l}`,
      email: `${f}.${l}${i + 1}@example.com`.toLowerCase(),
      department: departments[i % departments.length],
      salary: 40000 + ((i * 7919) % 90) * 1000,
      rating: (i * 3) % 6,
      progress: (i * 17) % 101,
      status: statuses[(i * 5) % statuses.length],
      joined: new Date(Date.UTC(2019 + (i % 6), (i * 5) % 12, 1 + (i % 28))).toISOString().slice(0, 10),
    };
  });
}
