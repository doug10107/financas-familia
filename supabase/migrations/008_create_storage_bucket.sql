-- Migration 8: Bucket de Armazenamento para Comprovantes
-- Arquivos limitados a 5MB, formatos: JPEG, PNG, WebP, PDF

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprovantes',
    'comprovantes',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

CREATE POLICY "Membros da familia fazem upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'comprovantes'
        AND (storage.foldername(name))[1] = public.get_my_family_id()::TEXT
    );

CREATE POLICY "Membros da familia veem comprovantes"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'comprovantes'
        AND (storage.foldername(name))[1] = public.get_my_family_id()::TEXT
    );

CREATE POLICY "Membros da familia deletam comprovantes"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'comprovantes'
        AND (storage.foldername(name))[1] = public.get_my_family_id()::TEXT
    );
