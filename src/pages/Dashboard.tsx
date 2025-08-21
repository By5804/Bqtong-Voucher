"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const DashboardPage = () => {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) {
      toast({
        title: "Error",
        description: "ID tidak boleh kosong.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    console.log("Submitted ID:", id);
    // Simulate an API call
    setTimeout(() => {
      toast({
        title: "Success",
        description: `ID "${id}" berhasil disubmit.`,
      });
      setId("");
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dashboard Input ID</CardTitle>
          <CardDescription>Masukkan ID pada form di bawah ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="id-input" className="block text-sm font-medium mb-2 text-left">
                ID
              </label>
              <Input
                id="id-input"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Contoh: 12345678"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Mengirim..." : "Kirim"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;