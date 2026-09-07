import { addCustomer } from "../../actions";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-lg font-semibold text-slate-900">Add customer</h1>

      <form action={addCustomer} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            name="name"
            required
            autoFocus
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Channel
            </label>
            <select
              name="contact_channel"
              defaultValue="facebook"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Handle / contact
            </label>
            <input
              name="contact_handle"
              placeholder="FB name, email, phone..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add customer
        </button>
      </form>
    </div>
  );
}
