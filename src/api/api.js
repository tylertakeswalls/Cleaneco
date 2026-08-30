const baseURL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

const request = async (method, url, data = null, options = {}) => {
    const token = sessionStorage.getItem("token");
    const headers = options.headers || {};
    
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (!(data instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        method,
        headers,
    };

    if (data) {
        config.body = data instanceof FormData ? data : JSON.stringify(data);
    }

    const response = await fetch(`${baseURL}${url}`, config);
    
    let responseData;
    if (options.responseType === 'blob') {
        responseData = await response.blob();
    } else {
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = await response.text();
        }
    }

    if (!response.ok) {
        const error = new Error(response.statusText);
        error.response = { status: response.status, data: responseData };
        throw error;
    }

    return { data: responseData, status: response.status };
};

const api = {
    get: (url, options) => request('GET', url, null, options),
    post: (url, data, options) => request('POST', url, data, options),
    put: (url, data, options) => request('PUT', url, data, options),
    delete: (url, options) => request('DELETE', url, null, options),
    defaults: { baseURL }
};

export default api;