document.addEventListener('DOMContentLoaded', async () => {
    // Состояние приложения
    const state = {
        branches: [],
        employees: [],
        positions: [],
        currentBranch: null,
        currentFilter: {
            search: '',
            position: ''
        }
    };

    // DOM элементы
    const elements = {
        branchTree: document.getElementById('branchTree'),
        searchInput: document.getElementById('searchInput'),
        positionFilter: document.getElementById('positionFilter'),
        employeesTable: document.getElementById('employeesTable'),
        addEmployeeBtn: document.getElementById('addEmployeeBtn'),
        modal: document.getElementById('addEmployeeModal'),
        closeModalBtn: document.querySelector('.close'),
        employeeForm: document.getElementById('employeeForm'),
        fullNameInput: document.getElementById('fullName'),
        birthDateInput: document.getElementById('birthDate'),
        positionSelect: document.getElementById('position'),
        branchSelect: document.getElementById('branch'),
        salaryInput: document.getElementById('salary'),
        hireDateInput: document.getElementById('hireDate')
    };

    // Загрузка данных
    const loadData = async () => {
        try {
            const [branches, employees, positions] = await Promise.all([
                fetch('/api/branches').then(res => res.json()),
                fetch('/api/employees').then(res => res.json()),
                fetch('/api/positions').then(res => res.json())
            ]);

            state.branches = branches;
            state.employees = employees;
            state.positions = positions;

            renderBranchTree();
            renderPositionFilter();
            renderEmployees(employees);
            setupModal();
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Ошибка загрузки данных');
        }
    };

    // Построение дерева филиалов
    const renderBranchTree = () => {
        const buildTree = (parentId = null) => {
            const children = state.branches.filter(b => b.parent_id === parentId);
            if (children.length === 0) return '';
            
            let html = '<ul>';
            children.forEach(branch => {
                html += `
                    <li>
                        <a href="#" data-id="${branch.id}" 
                           class="${state.currentBranch === branch.id ? 'active' : ''}">
                            ${branch.branch_name}
                        </a>
                        ${buildTree(branch.id)}
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        elements.branchTree.innerHTML = buildTree();
        setupBranchClickHandlers();
    };

    // Обработчики кликов по филиалам
    const setupBranchClickHandlers = () => {
        document.querySelectorAll('.tree a').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const branchId = parseInt(link.dataset.id);
                state.currentBranch = branchId;
                await loadBranchEmployees(branchId);
                renderBranchTree();
            });
        });
    };

    // Загрузка сотрудников филиала
    const loadBranchEmployees = async (branchId) => {
        try {
            const response = await fetch(`/api/branches/${branchId}/employees`);
            const employees = await response.json();
            state.employees = employees;
            renderEmployees(employees);
        } catch (error) {
            console.error('Error loading branch employees:', error);
            alert('Ошибка загрузки сотрудников филиала');
        }
    };

    // Заполнение фильтра должностей
    const renderPositionFilter = () => {
        elements.positionFilter.innerHTML = '<option value="">Все должности</option>';
        state.positions.forEach(position => {
            const option = document.createElement('option');
            option.value = position.id;
            option.textContent = position.position_name;
            elements.positionFilter.appendChild(option);
        });
    };

    // Отображение сотрудников с фильтрацией
    const renderEmployees = (employees) => {
        const filtered = filterEmployees(employees);
        const tbody = elements.employeesTable.querySelector('tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-results">Нет данных для отображения</td></tr>';
            return;
        }

        filtered.forEach(emp => {
            const branch = state.branches.find(b => b.id === emp.branch_id);
            const position = state.positions.find(p => p.id === emp.position_id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${emp.full_name}</td>
                <td>${position.position_name}</td>
                <td>${branch.branch_name}</td>
                <td>${emp.salary.toLocaleString('ru-RU')} ₽</td>
                <td>${new Date(emp.hire_date).toLocaleDateString('ru-RU')}</td>
                <td>
                    <button class="btn-delete" data-id="${emp.id}">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        setupDeleteHandlers();
    };

    // Фильтрация сотрудников
    const filterEmployees = (employees) => {
        let filtered = [...employees];
        
        if (state.currentFilter.search) {
            const searchTerm = state.currentFilter.search.toLowerCase();
            filtered = filtered.filter(emp => 
                emp.full_name.toLowerCase().includes(searchTerm)
            );
        }
        
        if (state.currentFilter.position) {
            filtered = filtered.filter(emp => 
                emp.position_id.toString() === state.currentFilter.position
            );
        }
        
        return filtered;
    };

    // Обработчики удаления
    const setupDeleteHandlers = () => {
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const employeeId = btn.dataset.id;
                await deleteEmployee(employeeId);
            });
        });
    };

    // Удаление сотрудника
    const deleteEmployee = async (employeeId) => {
        if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;

        try {
            const response = await fetch(`/api/employees/${employeeId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                state.employees = state.employees.filter(emp => emp.id.toString() !== employeeId);
                renderEmployees(state.employees);
                showToast('Сотрудник успешно удален', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Не удалось удалить сотрудника');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message, 'error');
        }
    };

    // Настройка модального окна
    const setupModal = () => {
        // Заполнение выпадающих списков
        elements.positionSelect.innerHTML = '';
        state.positions.forEach(position => {
            const option = document.createElement('option');
            option.value = position.id;
            option.textContent = position.position_name;
            elements.positionSelect.appendChild(option);
        });

        elements.branchSelect.innerHTML = '';
        state.branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.id;
            option.textContent = branch.branch_name;
            elements.branchSelect.appendChild(option);
        });

        // Обработчик отправки формы
        elements.employeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addEmployee();
        });
    };

    // Добавление сотрудника
    const addEmployee = async () => {
        const employeeData = {
            full_name: elements.fullNameInput.value.trim(),
            birth_date: elements.birthDateInput.value,
            position_id: elements.positionSelect.value,
            branch_id: elements.branchSelect.value,
            salary: parseFloat(elements.salaryInput.value),
            hire_date: elements.hireDateInput.value
        };

        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(employeeData)
            });

            if (response.ok) {
                const newEmployee = await response.json();
                state.employees.push(newEmployee);
                renderEmployees(state.employees);
                closeModal();
                showToast('Сотрудник успешно добавлен', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении сотрудника');
            }
        } catch (error) {
            console.error('Add employee error:', error);
            showToast(error.message, 'error');
        }
    };

    // Управление модальным окном
    const openModal = () => {
        elements.employeeForm.reset();
        elements.modal.style.display = 'block';
    };

    const closeModal = () => {
        elements.modal.style.display = 'none';
    };

    // Всплывающие уведомления
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    };

    // Обработчики событий
    elements.searchInput.addEventListener('input', (e) => {
        state.currentFilter.search = e.target.value.toLowerCase();
        renderEmployees(state.employees);
    });

    elements.positionFilter.addEventListener('change', (e) => {
        state.currentFilter.position = e.target.value;
        renderEmployees(state.employees);
    });

    elements.addEmployeeBtn.addEventListener('click', openModal);
    elements.closeModalBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });

    // Инициализация
    await loadData();
});