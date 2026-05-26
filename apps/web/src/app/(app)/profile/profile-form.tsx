"use client";

import { useActionState } from "react";
import type { DjProfile } from "@prisma/client";
import { saveDjProfile } from "@/features/dj/server/dj-profile-actions";

type DjProfileFormProps = {
  profile: DjProfile | null;
};

export function DjProfileForm({ profile }: DjProfileFormProps) {
  const [state, formAction, pending] = useActionState(saveDjProfile, {});

  return (
    <form action={formAction} className="profile-form">
      <h1>DJ Profile</h1>
      <label htmlFor="displayName">Display name</label>
      <input id="displayName" name="displayName" defaultValue={profile?.displayName ?? ""} required />
      <label htmlFor="city">City</label>
      <input id="city" name="city" defaultValue={profile?.city ?? ""} required />
      <label htmlFor="soundsystem">Soundsystem</label>
      <input id="soundsystem" name="soundsystem" defaultValue={profile?.soundsystem ?? ""} required />
      <label htmlFor="description">Description</label>
      <textarea id="description" name="description" defaultValue={profile?.description ?? ""} required />
      <label>
        <input name="active" type="checkbox" defaultChecked={profile?.active ?? true} />
        Active DJ profile
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Save DJ profile
      </button>
    </form>
  );
}
