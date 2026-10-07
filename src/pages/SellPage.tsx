import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Star, X } from 'lucide-react';
import { categoryGroups, getCategory } from '../config/categories';
import { site } from '../config/site';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createListing, fetchContactPhone, fetchListing, saveContactPhone, updateListing } from '../lib/api';
import { prepareImage } from '../lib/image';
import { deleteImages, uploadImage } from '../lib/media';
import { mediaUrl } from '../config/site';
import { conditionLabels, type Condition } from '../lib/types';
import { listingSchema, normalizeKenyanPhone } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

interface Photo {
  key: string;
  previewUrl: string;
  existing: boolean;
  path?: string;
  blob?: Blob;
}

interface FormState {
  title: string;
  category: string;
  description: string;
  price: string;
  negotiable: boolean;
  condition: Condition | '';
  location: string;
  phone: string;
  confirmRules: boolean;
  confirmAdult: boolean;
}

const emptyForm: FormState = {
  title: '',
  category: '',
  description: '',
  price: '',
  negotiable: false,
  condition: '',
  location: site.locations[0],
  phone: '',
  confirmRules: false,
  confirmAdult: false,
};

type Errors = Partial<Record<keyof FormState | 'photos', string>>;

export function SellPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit listing' : 'Post a listing');

  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [progress, setProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;

  const existing = useQuery({ queryKey: ['listing', id], queryFn: () => fetchListing(id as string), enabled: editing });
  const existingPhone = useQuery({ queryKey: ['phone', id, user?.id], queryFn: () => fetchContactPhone(id as string), enabled: editing });

  useEffect(() => {
    const l = existing.data;
    if (!l || prefilled.current || existingPhone.isLoading) return;
    prefilled.current = true;
    setForm({
      title: l.title,
      category: l.category,
      description: l.description,
      price: l.price === null ? '' : String(l.price),
      negotiable: l.negotiable,
      condition: l.condition ?? '',
      location: l.location,
      phone: existingPhone.data ?? '',
      confirmRules: true,
      confirmAdult: true,
    });
    setPhotos(l.images.map((path) => ({ key: path, previewUrl: mediaUrl(path), existing: true, path })));
  }, [existing.data, existingPhone.data, existingPhone.isLoading]);

  useEffect(
    () => () => {
      photosRef.current.forEach((p) => {
        if (!p.existing) URL.revokeObjectURL(p.previewUrl);
      });
    },
    [],
  );

  const category = form.category ? getCategory(form.category) : null;
  const isFree = category?.slug === 'free';
  const needsCondition = category ? category.goods !== false : false;
  const photosRequired = category ? !category.photosOptional : true;
  const priceOptional = Boolean(category?.photosOptional);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const room = site.maxImages - photos.length;
    if (files.length > room) toast.info(`You can add up to ${site.maxImages} photos. Extra photos were skipped.`);
    setProcessing(true);
    const added: Photo[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        const { blob } = await prepareImage(file);
        added.push({ key: crypto.randomUUID(), previewUrl: URL.createObjectURL(blob), existing: false, blob });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'That photo could not be added.');
      }
    }
    setProcessing(false);
    if (added.length) {
      setPhotos((p) => [...p, ...added]);
      setErrors((x) => ({ ...x, photos: undefined }));
    }
  }

  function removePhoto(photo: Photo) {
    setPhotos((p) => p.filter((x) => x.key !== photo.key));
    if (photo.existing && photo.path) setRemoved((r) => [...r, photo.path as string]);
    else URL.revokeObjectURL(photo.previewUrl);
  }

  function makeCover(photo: Photo) {
    setPhotos((p) => [photo, ...p.filter((x) => x.key !== photo.key)]);
  }

  function validate(): { ok: boolean; phone: string | null } {
    const next: Errors = {};
    const cat = form.category ? getCategory(form.category) : null;
    if (!cat) next.category = 'Choose a category.';

    const priceText = form.price.trim();
    const price = isFree ? 0 : priceText === '' ? null : Number(priceText);
    if (price === null && !priceOptional) next.price = 'Enter a price.';
    if (price !== null && !Number.isFinite(price)) next.price = 'Enter a number.';

    const condition = needsCondition ? form.condition || null : null;
    if (needsCondition && !condition) next.condition = 'Choose the condition.';

    const parsed = listingSchema.safeParse({
      title: form.title,
      category: form.category,
      description: form.description,
      price: price !== null && Number.isFinite(price) ? price : null,
      negotiable: form.negotiable,
      condition,
      location: form.location,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Errors;
        next[key] ??= issue.message;
      }
    }

    let phone: string | null = null;
    if (form.phone.trim()) {
      phone = normalizeKenyanPhone(form.phone);
      if (!phone) next.phone = 'Enter a Kenyan mobile number, like 0712 345 678.';
    }

    if (photosRequired && photos.length === 0) next.photos = 'Add at least one photo.';
    if (!form.confirmRules) next.confirmRules = 'Please confirm this before posting.';
    if (cat?.adultOnly && !form.confirmAdult) next.confirmAdult = 'Please confirm this before posting.';

    setErrors(next);
    return { ok: Object.keys(next).length === 0, phone };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const { ok, phone } = validate();
    if (!ok) {
      toast.error('Some details need fixing. Check the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      // Upload new photos one at a time (GitHub commits to one branch cannot run in parallel).
      const working = [...photos];
      const pending = working.filter((p) => !p.path && p.blob);
      let done = 0;
      for (const photo of pending) {
        setProgress(`Uploading photo ${done + 1} of ${pending.length}...`);
        photo.path = await uploadImage(photo.blob as Blob);
        done++;
        setPhotos([...working]);
      }

      setProgress('Saving your listing...');
      const cat = getCategory(form.category);
      const priceText = form.price.trim();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: isFree ? 0 : priceText === '' ? null : Number(priceText),
        negotiable: isFree ? false : form.negotiable,
        condition: cat.goods !== false ? (form.condition as Condition) : null,
        location: form.location.trim(),
        images: working.map((p) => p.path as string),
      };

      let listingId = id as string;
      if (editing) await updateListing(listingId, payload);
      else listingId = await createListing(payload);

      try {
        await saveContactPhone(listingId, phone);
      } catch {
        toast.error('The listing was saved, but the phone number could not be.');
      }

      if (removed.length) void deleteImages(removed).catch(() => undefined);

      void qc.invalidateQueries({ queryKey: ['listings'] });
      void qc.invalidateQueries({ queryKey: ['latest'] });
      void qc.invalidateQueries({ queryKey: ['my-listings'] });
      void qc.invalidateQueries({ queryKey: ['listing', listingId] });
      void qc.invalidateQueries({ queryKey: ['phone', listingId] });
      toast.success(editing ? 'Listing updated.' : 'Your listing is live.');
      navigate(`/listing/${listingId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the listing. Please try again.');
    } finally {
      setSaving(false);
      setProgress('');
    }
  }

  if (editing && existing.isLoading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (editing && existing.data && user && existing.data.seller_id !== user.id) {
    return (
      <div className="wrap page narrow">
        <h1>This is not your listing</h1>
        <Link to="/my-listings">Go to my listings</Link>
      </div>
    );
  }
  if (editing && !existing.data && !existing.isLoading) {
    return (
      <div className="wrap page narrow">
        <h1>Listing not found</h1>
        <Link to="/my-listings">Go to my listings</Link>
      </div>
    );
  }

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p className="field-error" id={`err-${key}`} role="alert">{errors[key]}</p>
    ) : null;
  const describedBy = (key: keyof Errors) => (errors[key] ? `err-${key}` : undefined);

  return (
    <div className="wrap page narrow">
      <h1>{editing ? 'Edit your listing' : 'Post a listing'}</h1>
      <p className="muted">Free to post. Your listing stays live for {site.listingLifetimeDays} days and you can renew it.</p>

      <form onSubmit={submit} className="form stack-lg" noValidate>
        <label className="field">
          <span>Category</span>
          <select
            value={form.category}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={describedBy('category')}
            onChange={(e) => {
              const slug = e.target.value;
              setForm((f) => ({ ...f, category: slug, price: slug === 'free' ? '0' : f.price === '0' ? '' : f.price }));
              setErrors((x) => ({ ...x, category: undefined }));
            }}
          >
            <option value="">Choose a category</option>
            {categoryGroups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
          {category && <small className="hint">{category.hint}</small>}
          {fieldError('category')}
        </label>

        <label className="field">
          <span>Title</span>
          <input
            value={form.title}
            maxLength={100}
            placeholder="What are you selling?"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={describedBy('title')}
            onChange={(e) => set('title', e.target.value)}
          />
          {fieldError('title')}
        </label>

        <div className="field-pair">
          <label className="field">
            <span>{category?.priceLabel ?? 'Price (KSh)'}{priceOptional && ' (optional)'}</span>
            <input
              inputMode="numeric"
              value={form.price}
              disabled={isFree}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={describedBy('price')}
              onChange={(e) => set('price', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {fieldError('price')}
          </label>
          {needsCondition && (
            <label className="field">
              <span>Condition</span>
              <select
                value={form.condition}
                aria-invalid={Boolean(errors.condition)}
                aria-describedby={describedBy('condition')}
                onChange={(e) => set('condition', e.target.value as Condition | '')}
              >
                <option value="">Choose</option>
                {Object.entries(conditionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {fieldError('condition')}
            </label>
          )}
        </div>
        {!isFree && (
          <label className="check">
            <input type="checkbox" checked={form.negotiable} onChange={(e) => set('negotiable', e.target.checked)} />
            <span>The price is negotiable</span>
          </label>
        )}

        <label className="field">
          <span>Where is it?</span>
          <input
            list="sell-places"
            value={form.location}
            maxLength={60}
            aria-invalid={Boolean(errors.location)}
            aria-describedby={describedBy('location')}
            onChange={(e) => set('location', e.target.value)}
          />
          <datalist id="sell-places">{site.locations.map((l) => <option key={l} value={l} />)}</datalist>
          <small className="hint">Give a town or area. Do not put your house address or plot number here.</small>
          {fieldError('location')}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            rows={7}
            value={form.description}
            maxLength={2000}
            placeholder="Describe the condition, age, what is included, and why you are selling."
            aria-invalid={Boolean(errors.description)}
            aria-describedby={describedBy('description')}
            onChange={(e) => set('description', e.target.value)}
          />
          <small className="hint">{form.description.length}/2000</small>
          {fieldError('description')}
        </label>

        <fieldset className="field photos">
          <legend>Photos{photosRequired ? '' : ' (optional)'}</legend>
          <small className="hint">
            Up to {site.maxImages}. The first photo is the cover. Photos are public, and location data is removed from them before upload.
            {category?.adultOnly && ' Only upload a photo of a person with their clear permission.'}
          </small>
          <ul className="photo-grid">
            {photos.map((p, i) => (
              <li key={p.key}>
                <img src={p.previewUrl} alt={`Photo ${i + 1}`} />
                <button type="button" className="photo-remove" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(p)}>
                  <X aria-hidden />
                </button>
                {i === 0 ? (
                  <span className="photo-cover">Cover</span>
                ) : (
                  <button type="button" className="photo-make-cover" onClick={() => makeCover(p)}>
                    <Star aria-hidden /> Make cover
                  </button>
                )}
              </li>
            ))}
            {photos.length < site.maxImages && (
              <li>
                <button type="button" className="photo-add" onClick={() => fileInput.current?.click()} disabled={processing || saving}>
                  <ImagePlus aria-hidden />
                  <span>{processing ? 'Preparing...' : 'Add photos'}</span>
                </button>
              </li>
            )}
          </ul>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} />
          {fieldError('photos')}
        </fieldset>

        <label className="field">
          <span>Phone number (optional)</span>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            placeholder="0712 345 678"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy('phone')}
            onChange={(e) => set('phone', e.target.value)}
          />
          <small className="hint">
            Hidden by default. Only logged-in members who tap "Show phone number" can see it. Leave it empty to be reached only through in-app messages.
          </small>
          {fieldError('phone')}
        </label>

        {category?.adultOnly && (
          <div>
            <label className="check">
              <input type="checkbox" checked={form.confirmAdult} onChange={(e) => set('confirmAdult', e.target.checked)} />
              <span>Everyone involved is 18 or older, and this is a genuine offer or request for work.</span>
            </label>
            {fieldError('confirmAdult')}
          </div>
        )}

        <div>
          <label className="check">
            <input type="checkbox" checked={form.confirmRules} onChange={(e) => set('confirmRules', e.target.checked)} />
            <span>
              I own this or am allowed to sell it, it is not on the <Link to="/rules" target="_blank">prohibited list</Link>, and I will never ask anyone to pay before they have seen it.
            </span>
          </label>
          {fieldError('confirmRules')}
        </div>

        <div className="actions">
          <Link to={editing ? '/my-listings' : '/'} className="btn btn-quiet">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving || processing}>
            {saving ? progress || 'Saving...' : editing ? 'Save changes' : 'Publish listing'}
          </button>
        </div>
      </form>
    </div>
  );
}
