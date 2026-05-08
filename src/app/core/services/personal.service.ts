import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface PersonaListItem {
  id: string;
  nombre: string;
  cedula: string;
}

@Injectable({ providedIn: 'root' })
export class PersonalService {
  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<PersonaListItem[]> {
    return this.http.get<PersonaListItem[]>(`${API_BASE_URL}/personal`, {
      withCredentials: true,
    });
  }
}
