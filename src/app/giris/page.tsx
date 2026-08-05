import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button, Field, inputClass } from "@/components/ui";
import { AuthError } from "next-auth";

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { hata } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/giris?hata=1");
      }
      throw error; // signIn başarılı olduğunda redirect hatası fırlatır — yut(ma)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-lg font-bold text-gray-900 mb-1">Sanat Yapıları Yönetim Sistemi</h1>
        <p className="text-sm text-gray-500 mb-6">Devam etmek için giriş yapın.</p>
        {hata && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
            E-posta veya şifre hatalı.
          </p>
        )}
        <form action={login} className="space-y-4">
          <Field label="E-posta" required>
            <input name="email" type="email" required className={inputClass} autoComplete="username" />
          </Field>
          <Field label="Şifre" required>
            <input
              name="password"
              type="password"
              required
              className={inputClass}
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Giriş Yap
          </Button>
        </form>
      </div>
    </main>
  );
}
