import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { FormulaEditorComponent } from './formula/formula-editor.component';
import { FieldDef } from './formula/formula-validator.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, FormulaEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'Expression Formula Editor';

  // Sample fields/variables available to the user's expressions.
  fields: FieldDef[] = [
    { name: 'A1', unit: 'kWh', description: 'Scalar input A1' },
    { name: 'A2', unit: 'kWh', description: 'Scalar input A2' },
    { name: 'M1', unit: 'kWh', description: 'Metered series M1' },
    { name: 'M2', unit: 'kWh', description: 'Metered series M2' },
    { name: 'Temperature', unit: '°C', description: 'Ambient temperature series' },
    { name: 'Power', unit: 'kW', description: 'Instantaneous power series' },
  ];

  formula = 'Add(A1, A2, RollingSum(M2, 60))';
  isValid = true;

  examples = [
    'Add(A1, A2, M2)',
    'IfElse(GreaterThan(M1, 100), M1, 0)',
    'RollingAvg(M2, 60)',
    'Coalesce(M1, M2, A1)',
    'IsWeekday(Interval(), 9, 17)',
  ];

  onValid(valid: boolean): void {
    this.isValid = valid;
  }

  loadExample(ex: string): void {
    this.formula = ex;
  }
}
